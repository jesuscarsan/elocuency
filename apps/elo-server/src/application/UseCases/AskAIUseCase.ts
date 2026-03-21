import { LLMServicePort, AskAIRequest, AskAIResponse } from '../../domain/ports/LLMServicePort';
import { ChatSession } from '../../domain/Entities/ChatSession';

export class AskAIUseCase {
  constructor(private readonly llmService: LLMServicePort) {}

  public async execute(session: ChatSession, request: AskAIRequest): Promise<AskAIResponse> {
    // Optionally add previous messages from session to the request if state management is needed
    // For now we just pass the request to the LLM
    const response = await this.llmService.ask(request);
    
    // We could store the AI response in the session here
    session.addMessage('assistant', response.content);

    return response;
  }
}
