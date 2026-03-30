import { TaskQueuePort, TaskType } from '../../domain/ports/TaskQueuePort';
import { ProcessSystemTaskUseCase } from '../../application/UseCases/ProcessSystemTaskUseCase';
import { LoggerPort } from '../../domain/ports/LoggerPort';

export class TaskWorkerService {
  private isProcessing = false;

  constructor(
    private readonly taskQueue: TaskQueuePort,
    private readonly processUseCase: ProcessSystemTaskUseCase,
    private readonly logger: LoggerPort
  ) {}

  public async start(): Promise<void> {
    this.logger.info('[TaskWorker] Starting worker service...');
    
    // 1. Initial check for pending tasks
    await this.processPendingTasks();

    // 2. Listen for new tasks
    await this.taskQueue.listen(async (taskId) => {
      this.logger.info(`[TaskWorker] Notification received for task ${taskId}`);
      await this.processPendingTasks();
    });
  }

  private async processPendingTasks(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      let task = await this.taskQueue.getNextTask();
      while (task) {
        try {
          await this.processUseCase.execute(task);
        } catch (e) {
          // Individual task failure handled in UseCase
        }
        task = await this.taskQueue.getNextTask();
      }
    } catch (error: any) {
      this.logger.error(`[TaskWorker] Error processing task queue: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }
}
