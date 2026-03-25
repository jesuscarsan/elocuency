export class VoiceRecordingService {
  private socket: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private isRecording: boolean = false;
  private serverUrl: string;

  constructor(serverUrl: string = 'ws://localhost:8001/ws/voice') {
    this.serverUrl = serverUrl;
  }

  async start(): Promise<void> {
    if (this.isRecording) return;

    this.socket = new WebSocket(this.serverUrl);
    this.socket.binaryType = 'arraybuffer';

    this.socket.onopen = () => console.log('Connected to elo-server voice interface');
    this.socket.onmessage = (event) => this.handleServerMessage(event.data);
    this.socket.onclose = () => this.stop();
    this.socket.onerror = (err) => console.error('WebSocket error:', err);

    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.processor.onaudioprocess = (e) => {
      if (!this.isRecording || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = this.floatTo16BitPCM(inputData);
      this.socket.send(pcmData);
    };

    this.isRecording = true;
  }

  stop(): void {
    this.isRecording = false;
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private handleServerMessage(data: string | ArrayBuffer): void {
    try {
      const msg = JSON.parse(typeof data === 'string' ? data : new TextDecoder().decode(data));
      if (msg.type === 'audio') {
        this.playAudioChunk(msg.data);
      }
      if (msg.type === 'text') {
        console.log('Gemini:', msg.text);
      }
    } catch (e) {
      // ignore non-JSON or malformed messages
    }
  }

  private async playAudioChunk(base64Data: string): Promise<void> {
    if (!this.audioContext) return;
    
    const binary = atob(base64Data);
    const len = binary.length;
    const bytes = new Int16Array(len / 2);
    for (let i = 0; i < len; i += 2) {
      bytes[i / 2] = (binary.charCodeAt(i + 1) << 8) | binary.charCodeAt(i);
    }

    const floatData = new Float32Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
       floatData[i] = bytes[i] / 32768.0;
    }

    const buffer = this.audioContext.createBuffer(1, floatData.length, 24000); // Gemini Live outputs 24kHz
    buffer.getChannelData(0).set(floatData);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.start();
  }

  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  }
}
