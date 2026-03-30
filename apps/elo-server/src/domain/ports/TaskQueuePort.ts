export enum TaskStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed'
}

export enum TaskType {
  ReindexNote = 'REINDEX_NOTE',
  SyncAll = 'SYNC_ALL',
  ApplyTemplate = 'APPLY_TEMPLATE',
  ProcessInbox = 'PROCESS_INBOX'
}

export interface SystemTask {
  id: string;
  queueName: string;
  payload: Record<string, any>;
  status: TaskStatus;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
  runAt: Date;
  lockedAt?: Date;
  finishedAt?: Date;
  errorMessage?: string;
}

export interface TaskQueuePort {
  enqueue(task: { queueName?: string; payload: Record<string, any>; runAt?: Date }): Promise<string>;
  getNextTask(): Promise<SystemTask | null>;
  completeTask(taskId: string): Promise<void>;
  failTask(taskId: string, error: string): Promise<void>;
  listen(callback: (taskId: string) => void): Promise<void>;
}
