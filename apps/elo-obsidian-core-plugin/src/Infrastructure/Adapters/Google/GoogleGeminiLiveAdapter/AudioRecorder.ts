import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';
import { TranslationService } from '@elo/obsidian-plugin';

// Inline AudioWorkletProcessor code to avoid file loading issues in Obsidian
const WORKLET_CODE = `
class GeminiAudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (!input || !input.length) return true;

        const channelData = input[0];
        
        for (let i = 0; i < channelData.length; i++) {
            this.buffer[this.bufferIndex++] = channelData[i];

            if (this.bufferIndex >= this.bufferSize) {
                this.flush();
            }
        }

        return true;
    }

    flush() {
        // Send the buffer to the main thread
        // We clone the buffer because the underlying ArrayBuffer might be detached or reused
        const dataToSend = new Float32Array(this.buffer);
        this.port.postMessage(dataToSend);
        this.bufferIndex = 0;
    }
}

registerProcessor('gemini-audio-processor', GeminiAudioProcessor);
`;

export class AudioRecorder {
	private mediaStream: MediaStream | null = null;
	private audioContext: AudioContext | null = null;
	private workletNode: AudioWorkletNode | null = null;
	private input: MediaStreamAudioSourceNode | null = null;
	private onDataAvailable: (base64Audio: string) => void;

	constructor(
		private readonly translationService: TranslationService,
		onDataAvailable: (base64Audio: string) => void,
	) {
		this.onDataAvailable = onDataAvailable;
	}

	async start(): Promise<boolean> {
		try {
			this.mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					channelCount: 1,
					sampleRate: 16000,
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			});

			this.audioContext = new AudioContext({
				sampleRate: 16000,
			});

			// Load the worklet from a Blob
			const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
			const workletUrl = URL.createObjectURL(blob);
			await this.audioContext.audioWorklet.addModule(workletUrl);

			this.input = this.audioContext.createMediaStreamSource(this.mediaStream);

			this.workletNode = new AudioWorkletNode(this.audioContext, 'gemini-audio-processor');

			this.workletNode.port.onmessage = (event) => {
				const float32Data = event.data;
				this.processAudio(float32Data);
			};

			this.input.connect(this.workletNode);
			this.workletNode.connect(this.audioContext.destination); // Connect to destination to keep the graph alive (often needed), or just let it run.
			// Note: Connecting to destination might cause feedback if not careful, but usually required for the graph to "pull" audio.
			// However, with Worklet, if we just want to process, we might not need to connect to destination if we return true.
			// But let's keep it disconnected from destination if we don't want to hear it?
			// Wait, usually we DON'T want to hear ourselves.
			// Let's TRY connecting to destination but maybe with gain 0 if needed?
			// Actually, AudioWorkletNode works as long as it's connected to something or the context is running?
			// "The audio graph is being driven by the AudioDestinationNode at the end."
			// If we don't connect to destination, the graph might not process.
			// BUT we don't want to play the audio back to the user (echo).
			// Common trick: connect to a GainNode with gain 0, then to destination.
			// Or just rely on modern browsers handling source nodes that are active?
			// Let's try connecting to a GainNode(0) -> Destination just to be safe and avoid echo.

			// Actually, let's just NOT connect to destination and see if it works.
			// If it stops processing, we add a mute node.
			// Update: Many browsers require a path to destination.
			const muteNode = this.audioContext.createGain();
			muteNode.gain.value = 0;
			this.workletNode.connect(muteNode);
			muteNode.connect(this.audioContext.destination);

			return true;
		} catch (error) {
			console.error('Error starting audio recording:', error);
			showMessage('geminiLive.micError', undefined, this.translationService);
			return false;
		}
	}

	stop(): void {
		if (this.mediaStream) {
			this.mediaStream.getTracks().forEach((track) => track.stop());
			this.mediaStream = null;
		}

		if (this.workletNode) {
			this.workletNode.disconnect();
			this.workletNode = null;
		}

		if (this.input) {
			this.input.disconnect();
			this.input = null;
		}

		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
		}
	}

	private processAudio(inputData: Float32Array): void {
		// Convert Float32Array to Int16Array (PCM)
		const pcmData = new Int16Array(inputData.length);
		for (let i = 0; i < inputData.length; i++) {
			// Clamp values to [-1, 1] and scale to 16-bit range
			const s = Math.max(-1, Math.min(1, inputData[i]));
			pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
		}

		// Convert Int16Array to Base64
		const buffer = pcmData.buffer;
		const base64 = this.arrayBufferToBase64(buffer);

		this.onDataAvailable(base64);
	}

	private arrayBufferToBase64(buffer: ArrayBuffer): string {
		let binary = '';
		const bytes = new Uint8Array(buffer);
		const len = bytes.byteLength;
		for (let i = 0; i < len; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return window.btoa(binary);
	}
}
