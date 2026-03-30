import { describe, it, expect, vi } from 'vitest';
import { RouteChatMessageUseCase } from './RouteChatMessageUseCase';
import { IntentAnalyzerPort } from '../../domain/ports/IntentAnalyzerPort';
import { SpecialistProcessorPort } from '../../domain/ports/SpecialistProcessorPort';
import { ChatSessionRepositoryPort } from '../../domain/ports/ChatSessionRepositoryPort';
import { LoggerPort } from '../../domain/ports/LoggerPort';
import { ChatSession } from '../../domain/Entities/ChatSession';
import { ChatCategory } from '../../domain/Entities/ChatIntent';

describe('RouteChatMessageUseCase', () => {
  it('should retrieve existing session, pass history to ports, and save new messages', async () => {
    // Arrange
    const userId = 'user-123';
    const existingSession = new ChatSession('session-1', userId);
    existingSession.addMessage('user', 'Hello');
    existingSession.addMessage('assistant', 'Hi! How can I help?');

    const mockRepo: ChatSessionRepositoryPort = {
      findByUserId: vi.fn().mockResolvedValue(existingSession),
      save: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn(),
    };

    const mockIntentAnalyzer: IntentAnalyzerPort = {
      analyze: vi.fn().mockResolvedValue({ intent: ChatCategory.AskMemory, extracted_context: 'Jose' }),
    };

    const mockSpecialistProcessor: SpecialistProcessorPort = {
      process: vi.fn().mockResolvedValue('Jose is your brother.'),
    };

    const mockLogger: LoggerPort = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    const useCase = new RouteChatMessageUseCase(
      mockIntentAnalyzer,
      mockSpecialistProcessor,
      mockRepo,
      mockLogger
    );

    // Act
    const response = await useCase.execute({ message: 'Who is Jose?', userId });

    // Assert
    expect(mockRepo.findByUserId).toHaveBeenCalledWith(userId);
    
    // History sent to analyzer and processor should include the 2 previous messages
    const historyInCall = (mockIntentAnalyzer.analyze as any).mock.calls[0][1];
    expect(historyInCall).toHaveLength(2);
    expect(historyInCall[0].content).toBe('Hello');

    expect(mockSpecialistProcessor.process).toHaveBeenCalledWith(
      expect.objectContaining({ intent: ChatCategory.AskMemory }),
      'Who is Jose?',
      historyInCall
    );

    // Session should now have 4 messages (2 old + 1 new user + 1 new assistant)
    expect(existingSession.getMessages()).toHaveLength(4);
    expect(mockRepo.save).toHaveBeenCalledWith(existingSession);
    expect(response.response).toBe('Jose is your brother.');
  });
});
