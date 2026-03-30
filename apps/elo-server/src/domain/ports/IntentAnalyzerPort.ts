import { ChatIntent } from '../Entities/ChatIntent';
import { ChatMessage } from '../Entities/ChatSession';

export interface IntentAnalyzerPort {
  analyze(message: string, history: ChatMessage[]): Promise<ChatIntent>;
}
