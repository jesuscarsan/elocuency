import { Pool, PoolClient } from 'pg';
import { TaskQueuePort, SystemTask, TaskStatus } from '../../../domain/ports/TaskQueuePort';
import { LoggerPort } from '../../../domain/ports/LoggerPort';
import fs from 'fs';
import path from 'path';

export class PgTaskQueueAdapter implements TaskQueuePort {
  private pool: Pool;
  private listenClient: PoolClient | null = null;

  constructor(connection: string | Pool, private readonly logger: LoggerPort) {
    if (typeof connection === 'string') {
      this.pool = new Pool({ connectionString: connection });
    } else {
      this.pool = connection;
    }
  }

  public async init(): Promise<void> {
    // Migration logic moved to external migrate.ts script.
    // This method is kept for backward compatibility and potential listener initialization.
    this.logger.debug('[PgTaskQueue] Adapter initialized (schema check skipped).');
  }

  public async enqueue(task: { queueName?: string; payload: Record<string, any>; runAt?: Date }): Promise<string> {
    const queueName = task.queueName || 'default';
    const runAt = task.runAt || new Date();
    
    const query = `
      INSERT INTO system_task (queue_name, payload, run_at, status)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    
    const result = await this.pool.query(query, [queueName, JSON.stringify(task.payload), runAt, TaskStatus.Pending]);
    return result.rows[0].id;
  }

  public async getNextTask(): Promise<SystemTask | null> {
    const query = `
      UPDATE system_task
      SET status = $1, 
          locked_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = (
          SELECT id
          FROM system_task
          WHERE status = $2 AND run_at <= CURRENT_TIMESTAMP
          ORDER BY run_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
      )
      RETURNING *
    `;
    
    const result = await this.pool.query(query, [TaskStatus.Processing, TaskStatus.Pending]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      id: row.id,
      queueName: row.queue_name,
      payload: row.payload,
      status: row.status as TaskStatus,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      runAt: row.run_at,
      lockedAt: row.locked_at,
      finishedAt: row.finished_at,
      errorMessage: row.error_message
    };
  }

  public async completeTask(taskId: string): Promise<void> {
    const query = `
      UPDATE system_task
      SET status = $1, 
          finished_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    await this.pool.query(query, [TaskStatus.Completed, taskId]);
  }

  public async failTask(taskId: string, error: string): Promise<void> {
    const query = `
      UPDATE system_task
      SET status = CASE WHEN retry_count < max_retries THEN 'pending' ELSE 'failed' END,
          retry_count = retry_count + 1,
          error_message = $1,
          updated_at = CURRENT_TIMESTAMP,
          run_at = CASE WHEN retry_count < max_retries THEN CURRENT_TIMESTAMP + interval '1 minute' ELSE run_at END
      WHERE id = $2
    `;
    await this.pool.query(query, [error, taskId]);
  }

  public async listen(callback: (taskId: string) => void): Promise<void> {
    if (this.listenClient) return;

    this.listenClient = await this.pool.connect();
    this.listenClient.on('notification', (msg) => {
      if (msg.channel === 'system_task_queued' && msg.payload) {
        callback(msg.payload);
      }
    });

    await this.listenClient.query('LISTEN system_task_queued');
    this.logger.info('[PgTaskQueue] Listening for system_task_queued notifications.');
  }

  public async close(): Promise<void> {
    if (this.listenClient) {
      this.listenClient.release();
      this.listenClient = null;
    }
    await this.pool.end();
  }
}
