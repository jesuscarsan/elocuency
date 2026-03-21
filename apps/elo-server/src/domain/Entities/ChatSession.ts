export type Role = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: Role;
  content: string;
  timestamp: Date;
}

export class ChatSession {
  private messages: ChatMessage[] = [];

  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly startedAt: Date = new Date(),
  ) {}

  public addMessage(role: Role, content: string): void {
    this.messages.push({
      role,
      content,
      timestamp: new Date()
    });
  }

  public getMessages(): ReadonlyArray<ChatMessage> {
    return [...this.messages];
  }

  public clearMessages(): void {
    this.messages = [];
  }
}
