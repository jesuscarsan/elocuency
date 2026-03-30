import { TaskType, SystemTask, TaskQueuePort } from '../../domain/ports/TaskQueuePort';
import { SyncMemoryUseCase } from './SyncMemoryUseCase';
import { ApplyTemplateAIUseCase } from './ApplyTemplateAIUseCase';
import { ProcessInboxUseCase } from './ProcessInboxUseCase';
import { LoggerPort } from '../../domain/ports/LoggerPort';

export class ProcessSystemTaskUseCase {
  constructor(
    private readonly taskQueue: TaskQueuePort,
    private readonly syncMemoryUseCase: SyncMemoryUseCase,
    private readonly applyTemplateAI: ApplyTemplateAIUseCase,
    private readonly processInbox: ProcessInboxUseCase,
    private readonly logger: LoggerPort
  ) {}

  public async execute(task: SystemTask): Promise<void> {
    const type = task.payload.type as TaskType;
    this.logger.info(`[ProcessSystemTask] Processing task ${task.id} (Type: ${type})`);

    try {
      switch (type) {
        case TaskType.ReindexNote:
          const notePath = task.payload.notePath;
          if (!notePath) throw new Error('Missing notePath in payload for REINDEX_NOTE');
          await this.syncMemoryUseCase.execute(true, notePath);
          break;

        case TaskType.SyncAll:
          await this.syncMemoryUseCase.execute(true);
          break;

        case TaskType.ApplyTemplate:
          const targetNotePath = task.payload.targetNotePath;
          const templateId = task.payload.templateId;
          const promptUrl = task.payload.promptUrl;
          if (!targetNotePath) throw new Error('Missing targetNotePath for APPLY_TEMPLATE');
          await this.applyTemplateAI.execute({ targetNotePath, templateId, promptUrl });
          break;

        case TaskType.ProcessInbox:
          await this.processInbox.execute();
          break;

        default:
          this.logger.warn(`[ProcessSystemTask] Unknown task type: ${type}`);
      }

      await this.taskQueue.completeTask(task.id);
      this.logger.info(`[ProcessSystemTask] Task ${task.id} completed.`);
    } catch (error: any) {
      this.logger.error(`[ProcessSystemTask] Task ${task.id} failed: ${error.message}`);
      await this.taskQueue.failTask(task.id, error.message);
      throw error;
    }
  }
}
