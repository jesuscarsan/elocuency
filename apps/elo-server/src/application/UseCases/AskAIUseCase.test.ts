import { describe, it, expect, vi } from 'vitest';
import { AskAIUseCase } from './AskAIUseCase';
import { LLMServicePort, AskAIRequest, AskAIResponse } from '../../domain/ports/LLMServicePort';
import { ChatSession } from '../../domain/Entities/ChatSession';

describe('AskAIUseCase', () => {
  it('should call llmService.ask and save assistant response in session', async () => {
    // Arrange
    const mockResponse: AskAIResponse = {
      content: 'Hello from AI',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
    };
    
    const llmService: LLMServicePort = {
      ask: vi.fn().mockResolvedValue(mockResponse),
      stream: vi.fn()
    };
    
    const useCase = new AskAIUseCase(llmService);
    const session = new ChatSession('session-1', 'user-1');
    session.addMessage('user', 'Hi');
    
    const request: AskAIRequest = {
      messages: [...session.getMessages()],
      systemPrompt: 'You are a helpful assistant'
    };

    // Act
    const result = await useCase.execute(session, request);

    // Assert
    expect(llmService.ask).toHaveBeenCalledWith(request);
    expect(result.content).toBe('Hello from AI');
    
    const messages = session.getMessages();
    expect(messages).toHaveLength(2);
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toBe('Hello from AI');
  });
});
