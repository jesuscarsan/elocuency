import { ImageContent } from "@elo/core";

export class ImageProcessor {
    static async processImage(buffer: ArrayBuffer, extension: string): Promise<ImageContent | null> {
        return new Promise((resolve) => {
            const blob = new Blob([buffer], { type: `image/${extension === 'jpg' ? 'jpeg' : extension}` });
            const url = URL.createObjectURL(blob);
            const img = new Image();

            img.onload = () => {
                URL.revokeObjectURL(url);
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 1024; // Resize to max 1024px to save tokens
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(null);
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);

                // JPEG with 0.8 quality for good compression
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                resolve({
                    data: dataUrl.split(',')[1], // Remove type prefix
                    mimeType: 'image/jpeg'
                });
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(null);
            };

            img.src = url;
        });
    }

    static async processBlob(blob: Blob): Promise<ImageContent | null> {
        const buffer = await blob.arrayBuffer();
        let extension = 'jpg';
        if (blob.type === 'image/png') extension = 'png';
        if (blob.type === 'image/webp') extension = 'webp';
        return this.processImage(buffer, extension);
    }
}
