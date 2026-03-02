import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';

import { TranslationService } from '@elo/obsidian-plugin';

export class AudioRecorder {
	constructor(private readonly translationService: TranslationService) {}
	private mediaRecorder: MediaRecorder | null = null;
	private audioChunks: Blob[] = [];
	private stream: MediaStream | null = null;

	async start(): Promise<boolean> {
		try {
			this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			this.mediaRecorder = new MediaRecorder(this.stream);
			this.audioChunks = [];

			this.mediaRecorder.ondataavailable = (event) => {
				this.audioChunks.push(event.data);
			};

			this.mediaRecorder.start();
			return true;
		} catch (error) {
			console.error('AudioRecorder: Error starting recording:', error);
			showMessage(this.translationService.t('geminiLive.micError'));
			return false;
		}
	}

	async stop(): Promise<Blob | null> {
		if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return null;

		return new Promise<Blob>((resolve) => {
			if (this.mediaRecorder) {
				this.mediaRecorder.onstop = () => {
					const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
					this.cleanup();
					resolve(audioBlob);
				};
				this.mediaRecorder.stop();
			}
		});
	}

	private cleanup() {
		if (this.stream) {
			this.stream.getTracks().forEach((track) => track.stop());
			this.stream = null;
		}
		this.mediaRecorder = null;
		this.audioChunks = [];
	}

	isRecording(): boolean {
		return this.mediaRecorder?.state === 'recording';
	}
}
