import { vi } from 'vitest';
import { AudioRecorder } from './ObsidianAudioRecorderAdapter';
import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';
import { createMockTranslationService } from '@/__test-utils__/mockFactories';

vi.mock('@/Infrastructure/Presentation/Obsidian/Utils/Messages', () => ({
	showMessage: vi.fn(),
}));

describe('AudioRecorder', () => {
	let recorder: AudioRecorder;
	let mockMediaRecorder: any;
	let mockStream: any;
	let translationService: any;

	beforeEach(() => {
		translationService = createMockTranslationService();
		mockStream = {
			getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }]),
		};

		mockMediaRecorder = {
			start: vi.fn(),
			stop: vi.fn(),
			state: 'inactive',
			ondataavailable: null,
			onstop: null,
		};

		// Mock browser globals
		(global as any).navigator.mediaDevices = {
			getUserMedia: vi.fn().mockResolvedValue(mockStream),
		};
		(global as any).MediaRecorder = class {
			constructor() {
				return mockMediaRecorder;
			}
		};
		(global as any).Blob = vi.fn();

		recorder = new AudioRecorder(translationService);
	});

	it('should start recording', async () => {
		const success = await recorder.start();
		expect(success).toBe(true);
		expect(mockMediaRecorder.start).toHaveBeenCalled();
		expect(recorder.isRecording()).toBe(false); // mock state is 'inactive' initially
	});

	it('should stop recording and return blob', async () => {
		await recorder.start();
		mockMediaRecorder.state = 'recording';

		const stopPromise = recorder.stop();

		// Simulate stop event
		mockMediaRecorder.onstop();

		const result = await stopPromise;
		expect(mockMediaRecorder.stop).toHaveBeenCalled();
		expect(result).toBeDefined();
	});

	it('should handle errors during start', async () => {
		(global as any).navigator.mediaDevices.getUserMedia.mockRejectedValue(new Error('No mic'));

		const success = await recorder.start();

		expect(success).toBe(false);
		expect(showMessage).toHaveBeenCalledWith('geminiLive.micError');
	});
});
