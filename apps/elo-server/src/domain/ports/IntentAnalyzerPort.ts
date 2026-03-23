import { ChatIntent } from '../Entities/ChatIntent';

export interface IntentAnalyzerPort {
  analyze(message: string): Promise<ChatIntent>;
}
