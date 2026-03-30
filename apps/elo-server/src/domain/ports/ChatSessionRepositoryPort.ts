import { ChatSession } from '../Entities/ChatSession';

export interface ChatSessionRepositoryPort {
  findByUserId(userId: string): Promise<ChatSession | null>;
  save(session: ChatSession): Promise<void>;
  clear(userId: string): Promise<void>;
}
