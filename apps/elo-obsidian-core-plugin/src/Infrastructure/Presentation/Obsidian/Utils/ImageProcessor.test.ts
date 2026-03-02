import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImageProcessor } from './ImageProcessor';

describe('ImageProcessor', () => {
	let originalBlob: any;
	let originalURL: any;
	let originalImage: any;
	let originalDocument: any;

	beforeEach(() => {
		// Mock Browser APIs
		originalBlob = global.Blob;
		originalURL = global.URL;
		originalImage = global.Image;
		originalDocument = global.document;

		global.Blob = class {
			constructor(content: any[], options: any) {
				(this as any).content = content;
				(this as any).type = options?.type;
			}
			arrayBuffer() {
				return Promise.resolve(new ArrayBuffer(8));
			}
		} as any;

		global.URL = {
			createObjectURL: vi.fn(),
			revokeObjectURL: vi.fn(),
		} as any;

		// Mock Image
		global.Image = class {
			onload: () => void = () => {};
			onerror: () => void = () => {};
			width: number = 100;
			height: number = 100;
			set src(val: string) {
				setTimeout(() => this.onload(), 0);
			}
		} as any;

		// Mock Canvas
		const mockContext = {
			drawImage: vi.fn(),
		};
		const mockCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn().mockReturnValue(mockContext),
			toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,mockbase64'),
		};
		global.document = {
			createElement: vi.fn().mockReturnValue(mockCanvas),
		} as any;
	});

	afterEach(() => {
		global.Blob = originalBlob;
		global.URL = originalURL;
		global.Image = originalImage;
		global.document = originalDocument;
	});

	it('should process image buffer', async () => {
		const buffer = new ArrayBuffer(8);
		const result = await ImageProcessor.processImage(buffer, 'jpg');

		expect(result).not.toBeNull();
		expect(result?.mimeType).toBe('image/jpeg');
		expect(result?.data).toBe('mockbase64');
		expect(global.URL.createObjectURL).toHaveBeenCalled();
	});

	it('should resize large images', async () => {
		// Mock large image
		global.Image = class {
			onload: () => void = () => {};
			width: number = 2048;
			height: number = 1024;
			set src(val: string) {
				setTimeout(() => this.onload(), 0);
			}
		} as any;

		const buffer = new ArrayBuffer(8);
		await ImageProcessor.processImage(buffer, 'png');

		const canvas = (document.createElement as any).mock.results[0].value;
		expect(canvas.width).toBe(1024);
		expect(canvas.height).toBe(512);
	});

	it('should resize large horizontal images', async () => {
		// Mock large image
		global.Image = class {
			onload: () => void = () => {};
			width: number = 2048;
			height: number = 512;
			set src(val: string) {
				setTimeout(() => this.onload(), 0);
			}
		} as any;

		const buffer = new ArrayBuffer(8);
		await ImageProcessor.processImage(buffer, 'png');

		const canvas = (document.createElement as any).mock.results[0].value;
		expect(canvas.width).toBe(1024);
		expect(canvas.height).toBe(256);
	});

	it('should resize large vertical images', async () => {
		// Mock large image
		global.Image = class {
			onload: () => void = () => {};
			width: number = 1024;
			height: number = 2048;
			set src(val: string) {
				setTimeout(() => this.onload(), 0);
			}
		} as any;

		const buffer = new ArrayBuffer(8);
		await ImageProcessor.processImage(buffer, 'png');

		const canvas = (document.createElement as any).mock.results[0].value;
		expect(canvas.width).toBe(512);
		expect(canvas.height).toBe(1024);
	});

	it('should handle context failure', async () => {
		const mockCanvas = {
			width: 0,
			height: 0,
			getContext: vi.fn().mockReturnValue(null), // Null context
		};
		global.document = {
			createElement: vi.fn().mockReturnValue(mockCanvas),
		} as any;

		const buffer = new ArrayBuffer(8);
		const result = await ImageProcessor.processImage(buffer, 'jpg');
		expect(result).toBeNull();
	});

	it('should process blob', async () => {
		const blob = new Blob([], { type: 'image/jpeg' });
		const result = await ImageProcessor.processBlob(blob);

		expect(result).not.toBeNull();
		expect(result?.mimeType).toBe('image/jpeg');
	});

	it('should process png blob', async () => {
		const blob = new Blob([], { type: 'image/png' });
		const result = await ImageProcessor.processBlob(blob);
		expect(result).not.toBeNull();
		// It's processed to jpeg in the end
		expect(result?.mimeType).toBe('image/jpeg');
	});

	it('should process webp blob', async () => {
		const blob = new Blob([], { type: 'image/webp' });
		const result = await ImageProcessor.processBlob(blob);
		expect(result).not.toBeNull();
		expect(result?.mimeType).toBe('image/jpeg');
	});

	it('should handle image error', async () => {
		global.Image = class {
			onload: () => void = () => {};
			onerror: () => void = () => {};
			set src(val: string) {
				setTimeout(() => this.onerror(), 0);
			}
		} as any;

		const buffer = new ArrayBuffer(8);
		const result = await ImageProcessor.processImage(buffer, 'jpg');

		expect(result).toBeNull();
	});
});
