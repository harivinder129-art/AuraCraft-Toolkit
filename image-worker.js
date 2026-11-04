self.onmessage = async function (event) {
    const { blob, mimeType, quality } = event.data;
    let imageBitmap = null;

    try {
        imageBitmap = await createImageBitmap(blob);
        if (quality === 100 || mimeType === 'image/svg+xml') {
            imageBitmap.close();
            self.postMessage({
                error: null,
                preserveOriginal: true
            });
            return;
        }

        const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
        const context = canvas.getContext('2d');
        context.drawImage(imageBitmap, 0, 0);
        imageBitmap.close();

        const compressedBlob = await canvas.convertToBlob({
            type: 'image/jpeg',
            quality: quality / 100
        });

        self.postMessage({
            error: null,
            compressedBlob: compressedBlob
        });
    } catch (error) {
        if (imageBitmap) imageBitmap.close();
        self.postMessage({
            error: error instanceof Error ? error.message : String(error),
            compressedBlob: null
        });
    }
};
