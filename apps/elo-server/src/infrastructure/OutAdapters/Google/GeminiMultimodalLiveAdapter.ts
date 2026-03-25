import { LiveVoicePort, LiveVoiceSession } from '../../../domain/ports/LiveVoicePort';
import { LoggerPort } from '../../../domain/ports/LoggerPort';
import WebSocket from 'ws';

export class GeminiMultimodalLiveAdapter implements LiveVoicePort {
  private apiKey: string;
  private logger: LoggerPort;

  constructor(apiKey: string, logger: LoggerPort) {
    this.apiKey = apiKey;
    this.logger = logger;
  }

  async createSession(config: {
    model: string;
    systemInstruction?: string;
    tools?: any[];
  }): Promise<LiveVoiceSession> {
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BiDiGenerateContent?key=${this.apiKey}`;
    const ws = new WebSocket(url);

    return new GeminiLiveSession(ws, config, this.logger);
  }
}

class GeminiLiveSession implements LiveVoiceSession {
  private ws: WebSocket;
  private logger: LoggerPort;
  private audioCallbacks: ((chunk: Buffer) => void)[] = [];
  private textCallbacks: ((text: string) => void)[] = [];
  private toolCallCallbacks: ((toolCall: any) => void)[] = [];
  private closeCallbacks: (() => void)[] = [];

  constructor(ws: WebSocket, config: any, logger: LoggerPort) {
    this.ws = ws;
    this.logger = logger;

    this.ws.on('open', () => {
      this.logger.info('Connected to Gemini Multimodal Live API');
      
      // Send Setup message
      const setupMsg = {
        setup: {
          model: `models/${config.model}`,
          generation_config: {
            response_modalities: ["audio"]
          },
          system_instruction: config.systemInstruction ? {
             parts: [{ text: config.systemInstruction }]
          } : undefined,
          tools: config.tools ? [{ function_declarations: config.tools }] : undefined
        }
      };
      this.ws.send(JSON.stringify(setupMsg));
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());
        
        if (msg.serverContent) {
          const modelTurn = msg.serverContent.modelTurn;
          if (modelTurn && modelTurn.parts) {
            for (const part of modelTurn.parts) {
              if (part.inlineData && part.inlineData.mimeType.startsWith('audio/')) {
                const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
                this.audioCallbacks.forEach(cb => cb(audioBuffer));
              }
              if (part.text) {
                this.textCallbacks.forEach(cb => cb(part.text));
              }
            }
          }
        }
        
        if (msg.toolCall) {
          this.toolCallCallbacks.forEach(cb => cb(msg.toolCall));
        }
      } catch (err: any) {
        this.logger.error(`Error parsing Gemini Live message: ${err.message}`);
      }
    });

    this.ws.on('close', () => {
      this.logger.info('Gemini Live API connection closed');
      this.closeCallbacks.forEach(cb => cb());
    });

    this.ws.on('error', (err: any) => {
      this.logger.error(`Gemini Live API WebSocket error: ${err.message}`);
    });
  }

  sendAudio(chunk: Buffer | string): void {
    const data = typeof chunk === 'string' ? chunk : chunk.toString('base64');
    const msg = {
      realtime_input: {
        media_chunks: [
          {
            mime_type: "audio/pcm;rate=16000",
            data: data
          }
        ]
      }
    };
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  sendText(text: string): void {
     const msg = {
      realtime_input: {
        text: text
      }
    };
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  sendToolResponse(response: any): void {
    const msg = {
      tool_response: response
    };
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  close(): void {
    this.ws.close();
  }

  onAudio(callback: (chunk: Buffer) => void): void {
    this.audioCallbacks.push(callback);
  }

  onText(callback: (text: string) => void): void {
    this.textCallbacks.push(callback);
  }

  onToolCall(callback: (toolCall: any) => void): void {
    this.toolCallCallbacks.push(callback);
  }

  onClose(callback: () => void): void {
    this.closeCallbacks.push(callback);
  }
}
