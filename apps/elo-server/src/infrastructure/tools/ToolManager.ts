import { StructuredTool as BaseTool } from '@langchain/core/tools';
import { LoggerPort } from '../../domain/ports/LoggerPort';
import { NoteRepositoryPort } from '../../domain/ports/NoteRepositoryPort';
import { TaskQueuePort } from '../../domain/ports/TaskQueuePort';
import { ApplyTemplateAIUseCase } from '../../application/UseCases/ApplyTemplateAIUseCase';
import { ManageNoteTool } from './ManageNoteTool';

export class ToolManager {
  constructor(
    private readonly noteRepository: NoteRepositoryPort,
    private readonly taskQueue: TaskQueuePort,
    private readonly applyTemplateUseCase: ApplyTemplateAIUseCase,
    private readonly logger: LoggerPort,
    private readonly memoryPath: string
  ) {}

  public getNoteManagementTools(): BaseTool[] {
    return [
      new ManageNoteTool(
        this.noteRepository,
        this.taskQueue,
        this.applyTemplateUseCase,
        this.logger,
        this.memoryPath
      )
    ];
  }

  /**
   * Returns all activated tools based on configuration.
   * This is where future MCP tools or dynamic tools would be integrated.
   */
  public getAllTools(): BaseTool[] {
    return [
      ...this.getNoteManagementTools(),
      // Add other tools here (e.g. n8n, etc)
    ];
  }
}
