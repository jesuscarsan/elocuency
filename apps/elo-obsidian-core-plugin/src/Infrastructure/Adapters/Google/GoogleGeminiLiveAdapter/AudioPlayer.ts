export class AudioPlayer {
    private audioContext: AudioContext;
    private isPlaying: boolean = false;
    private startTime: number = 0;
    private queue: ArrayBuffer[] = [];
    private onStateChange: (isPlaying: boolean) => void;

    constructor(onStateChange?: (isPlaying: boolean) => void) {
        this.onStateChange = onStateChange || (() => { });
        // Gemini output typically defaults to 24000Hz, but we let the system decide the context rate
        // and handle resampling via createBuffer parameters.
        this.audioContext = new AudioContext({ latencyHint: 'interactive' });
    }

    async resume(): Promise<void> {
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    addPcmData(base64Data: string): void {
        const pcmData = this.base64ToArrayBuffer(base64Data);
        this.queue.push(pcmData);
        this.scheduleNextBuffer();
    }

    private scheduleNextBuffer(): void {
        if (this.queue.length === 0) return;

        // Safety check: ensure context is running if we have data to play
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        if (!this.isPlaying) {
            this.isPlaying = true;
            this.onStateChange(true);
            this.startTime = this.audioContext.currentTime + 0.1; // Small buffer
        }

        const nextBuffer = this.queue.shift();
        if (nextBuffer) {
            this.playBuffer(nextBuffer);
        }
    }

    private playBuffer(arrayBuffer: ArrayBuffer): void {
        // console.log(`AudioPlayer: Playing buffer (len: ${arrayBuffer.byteLength}). CtxState: ${this.audioContext.state}`);
        // Assuming 16-bit PCM, 1 channel, 24kHz (default Gemini output)
        const int16Array = new Int16Array(arrayBuffer);
        const float32Array = new Float32Array(int16Array.length);

        for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 32768;
        }

        const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, 24000);
        audioBuffer.copyToChannel(float32Array, 0, 0);

        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);

        // Schedule playback ensuring no overlaps/gaps
        const playTime = Math.max(this.audioContext.currentTime, this.startTime);
        source.start(playTime);

        this.startTime = playTime + audioBuffer.duration;

        source.onended = () => {
            if (this.queue.length > 0) {
                this.scheduleNextBuffer(); // Trigger next immediately if available but logic handled by fire-and-forget scheduling mostly
            } else {
                // Check if queue empty and time passed?
                // Simple logic: if queue empty, we might stop playing soon.
                if (this.audioContext.currentTime >= this.startTime) {
                    this.isPlaying = false;
                    this.onStateChange(false);
                }
            }
        };
    }

    async close(): Promise<void> {
        this.queue = [];
        this.isPlaying = false;
        this.onStateChange(false);
        if (this.audioContext.state !== 'closed') {
            await this.audioContext.close();
        }
    }

    clearQueue(): void {
        this.queue = [];
        this.isPlaying = false;
        this.onStateChange(false);
        // Do not suspend here, as it might interfere with reuse or cleanup. 
        // We rely on 'close()' for final cleanup.
    }

    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }
}
