import { ChatIntent } from '../Entities/ChatIntent';

export interface SpecialistProcessorPort {
  process(intent: ChatIntent, message: string): Promise<string>;
}
