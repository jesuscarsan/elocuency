import { LLMServicePort } from '../../domain/ports/LLMServicePort';
import { PROCESS_TASK_SYSTEM_PROMPT } from '../../infrastructure/Prompts/TaskExecutionPrompts';

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
        systemPrompt: PROCESS_TASK_SYSTEM_PROMPT,
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
