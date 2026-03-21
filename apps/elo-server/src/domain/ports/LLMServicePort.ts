export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface AskAIRequest {
  messages: LLMMessage[];
  systemPrompt?: string;
  enableTools?: boolean;
}

export interface AskAIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMServicePort {
  ask(request: AskAIRequest): Promise<AskAIResponse>;
  stream(request: AskAIRequest, onToken: (token: string) => void): Promise<AskAIResponse>;
}
