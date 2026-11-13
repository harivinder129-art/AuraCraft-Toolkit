/**
 * heic-worker.js — Off-main-thread WebAssembly HEIC/HEIF Decoder Worker
 * 
 * Powered by libheif + libde265 compiled to native WebAssembly with OffscreenCanvas.
 * Optimized with direct C++ embind decoding (zero-copy memory view).
 */

'use strict';

let libheifModule = null;

function getLibheif() {
    if (!libheifModule) {
        if (typeof libheif === 'undefined' && typeof self.libheif === 'undefined') {
            importScripts('libheif-bundle.js?v=47');
        }
        const factory = typeof libheif !== 'undefined' ? libheif : self.libheif;
        if (typeof factory !== 'function') {
            throw new Error('libheif WebAssembly module factory is not available');
        }
        libheifModule = factory();
    }
    return libheifModule;
}

self.onmessage = async function (e) {
    const { id, buffer, quality = 0.82 } = e.data;

    let decoder = null;
    let images = null;
    let decodeResult = null;
    let mod = null;

    try {
        mod = getLibheif();
        if (!mod || !mod.HeifDecoder) {
            throw new Error('HeifDecoder constructor not found in libheif module');
        }

        decoder = new mod.HeifDecoder();
        images = decoder.decode(new Uint8Array(buffer));

        if (!images || images.length === 0) {
            throw new Error('No HEIC/HEIF images found in input data');
        }

        const primaryImage = images[0];
        const width = primaryImage.get_width();
        const height = primaryImage.get_height();

        if (!width || !height || width <= 0 || height <= 0) {
            throw new Error(`Invalid HEIC image dimensions: ${width}x${height}`);
        }

        // Direct C++ embind decode: Bypasses JS timer overhead and avoids 150MB buffer cloning
        decodeResult = mod.heif_js_decode_image2(
            primaryImage.handle,
            mod.heif_colorspace.heif_colorspace_RGB,
            mod.heif_chroma.heif_chroma_interleaved_RGBA
        );

        if (!decodeResult || decodeResult.code || !decodeResult.channels || !decodeResult.channels.length) {
            throw new Error('HEIC native bitstream decode failed');
        }

        const channel = decodeResult.channels[0];
        let clampedData;
        if (channel.stride === width * 4) {
            // Instant zero-copy memory view directly over the WebAssembly linear memory
            clampedData = new Uint8ClampedArray(channel.data.buffer, channel.data.byteOffset, channel.data.byteLength);
        } else {
            clampedData = new Uint8ClampedArray(width * height * 4);
            const w4 = width * 4;
            const stride = channel.stride;
            for (let y = 0; y < height; y++) {
                clampedData.set(channel.data.subarray(y * stride, y * stride + w4), y * w4);
            }
        }

        // In-worker OffscreenCanvas conversion directly to JPEG Blob
        if (typeof OffscreenCanvas !== 'undefined') {
            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d');
            const imgData = new ImageData(clampedData, width, height);
            ctx.putImageData(imgData, 0, 0);

            // Clean up C++ image buffers now that pixels are committed to canvas surface
            if (decodeResult && decodeResult.image && mod.heif_image_release) {
                try { mod.heif_image_release(decodeResult.image); } catch (_) { }
                decodeResult.image = null;
            }
            primaryImage.free();
            for (let i = 1; i < images.length; i++) {
                try { images[i].free(); } catch (_) { }
            }
            images = null;

            if (decoder.decoder && mod.heif_context_free) {
                try { mod.heif_context_free(decoder.decoder); } catch (_) { }
                decoder.decoder = null;
            }
            decoder = null;

            if (typeof canvas.convertToBlob === 'function') {
                const jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: quality });
                self.postMessage({ id, success: true, blob: jpegBlob, width, height });
                return;
            }
        }

        // Fallback: Transfer raw buffer to main thread for canvas encoding
        const transferBuffer = clampedData.slice(0).buffer;
        self.postMessage(
            { id, success: true, rawData: new Uint8ClampedArray(transferBuffer), width, height },
            [transferBuffer]
        );

    } catch (err) {
        self.postMessage({
            id,
            success: false,
            error: err && err.message ? err.message : String(err)
        });
    } finally {
        if (decodeResult && decodeResult.image && mod && mod.heif_image_release) {
            try { mod.heif_image_release(decodeResult.image); } catch (_) { }
        }
        if (images && images.length) {
            for (let i = 0; i < images.length; i++) {
                try { images[i].free(); } catch (_) { }
            }
        }
        if (decoder && decoder.decoder && libheifModule && libheifModule.heif_context_free) {
            try { libheifModule.heif_context_free(decoder.decoder); } catch (_) { }
        }
    }
};
