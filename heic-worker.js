/**
 * heic-worker.js — Off-main-thread WebAssembly HEIC/HEIF Decoder Worker
 * 
 * Powered by libheif + libde265 compiled to native WebAssembly with OffscreenCanvas.
 * Decodes HEVC/H.265 bitstreams directly into JPEG Blobs at near-native CPU speeds (~2s).
 */

'use strict';

let libheifModule = null;

function getLibheif() {
    if (!libheifModule) {
        if (typeof libheif === 'undefined' && typeof self.libheif === 'undefined') {
            importScripts('libheif-bundle.js?v=46');
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
    const { id, buffer, quality = 0.85 } = e.data;

    let decoder = null;
    let images = null;

    try {
        const mod = getLibheif();
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

        const rawData = new Uint8ClampedArray(width * height * 4);

        await new Promise((resolve, reject) => {
            primaryImage.display({ data: rawData, width, height }, (displayData) => {
                if (!displayData) {
                    return reject(new Error('HEIC bitstream decode/display failed'));
                }
                resolve(displayData);
            });
        });

        // Release C++ memory immediately after raw RGBA pixels are extracted
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

        // In-worker OffscreenCanvas conversion directly to JPEG Blob
        if (typeof OffscreenCanvas !== 'undefined') {
            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d');
            const imgData = new ImageData(rawData, width, height);
            ctx.putImageData(imgData, 0, 0);

            if (typeof canvas.convertToBlob === 'function') {
                const jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: quality });
                self.postMessage({ id, success: true, blob: jpegBlob, width, height });
                return;
            }
        }

        // Fallback: Transfer raw RGBA buffer to main thread for canvas encoding
        self.postMessage(
            { id, success: true, rawData, width, height },
            [rawData.buffer]
        );

    } catch (err) {
        if (images && images.length) {
            for (let i = 0; i < images.length; i++) {
                try { images[i].free(); } catch (_) { }
            }
        }
        if (decoder && decoder.decoder && libheifModule && libheifModule.heif_context_free) {
            try { libheifModule.heif_context_free(decoder.decoder); } catch (_) { }
        }
        self.postMessage({
            id,
            success: false,
            error: err && err.message ? err.message : String(err)
        });
    }
};
