import { LLMServicePort } from '../../domain/ports/LLMServicePort';

export interface TaskInput {
  description: string;
  context?: Record<string, unknown>;
}

export interface TaskResult {
  success: boolean;
  output: string;
  details?: unknown;
}

export class ProcessTaskUseCase {
  constructor(private readonly llmService: LLMServicePort) {}

  public async execute(input: TaskInput): Promise<TaskResult> {
    try {
      const response = await this.llmService.ask({
        messages: [{ role: 'user', content: input.description }],
        systemPrompt: 'You are an AI assistant designed to execute the specified task. Explain your steps and output the result.',
      });

      return {
        success: true,
        output: response.content,
      };
    } catch (error) {
       return {
         success: false,
         output: 'Failed to process task',
         details: error,
       };
    }
  }
}
