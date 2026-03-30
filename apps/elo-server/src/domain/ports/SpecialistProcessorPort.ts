import { ChatIntent } from '../Entities/ChatIntent';
import { ChatMessage } from '../Entities/ChatSession';

export interface SpecialistProcessorPort {
  process(intent: ChatIntent, message: string, history: ChatMessage[], userId: string): Promise<string>;
}
