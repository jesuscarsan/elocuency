export interface LiveVoiceSession {
  sendAudio(chunk: Buffer | string): void;
  sendText(text: string): void;
  sendToolResponse(response: any): void;
  close(): void;
  onAudio(callback: (chunk: Buffer) => void): void;
  onText(callback: (text: string) => void): void;
  onToolCall(callback: (toolCall: any) => void): void;
  onClose(callback: () => void): void;
}

export interface LiveVoicePort {
  createSession(config: {
    model: string;
    systemInstruction?: string;
    tools?: any[];
  }): Promise<LiveVoiceSession>;
}
