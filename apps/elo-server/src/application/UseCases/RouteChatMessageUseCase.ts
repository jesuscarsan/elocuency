import { ChatSessionRepositoryPort } from '../../domain/ports/ChatSessionRepositoryPort';
import { LoggerPort } from '../../domain/ports/LoggerPort';
import { MasterConversationGraph } from '../../infrastructure/OutAdapters/LangGraph/MasterConversationGraph';
import { ChatSession } from '../../domain/Entities/ChatSession';
import { randomUUID } from 'crypto';

export interface RouteChatMessageRequest {
  message: string;
  userId: string;
}

export interface RouteChatMessageResponse {
  intent: string;
  response: string;
}

export class RouteChatMessageUseCase {
  constructor(
    private readonly masterGraph: MasterConversationGraph,
    private readonly chatSessionRepository: ChatSessionRepositoryPort,
    private readonly logger: LoggerPort
  ) {}

  public async execute(request: RouteChatMessageRequest): Promise<RouteChatMessageResponse> {
    // 1. Retrieve or create chat session
    let session = await this.chatSessionRepository.findByUserId(request.userId);
    if (!session) {
      session = new ChatSession(randomUUID(), request.userId);
    }

    const history = [...session.getMessages()]; // Spread to convert readonly to mutable array

    // 2. Execute Master Conversation Graph
    const graph = this.masterGraph.createGraph();
    const config = { configurable: { thread_id: request.userId } };

    const result = await graph.invoke({
      input: request.message,
      history: history,
      userId: request.userId,
      status: 'analyzing'
    }, config);

    console.log(`[UseCase] Graph Result:`, JSON.stringify(result));
    const response = result.response || `[ERROR]: No response generated.`;

    // 3. Update session history
    session.addMessage('user', request.message);
    session.addMessage('assistant', response);
    await this.chatSessionRepository.save(session);

    return {
      intent: result.intent || 'unknown',
      response,
    };
  }
}
