import { Pool } from 'pg';
import { ChatSessionRepositoryPort } from '../../../domain/ports/ChatSessionRepositoryPort';
import { ChatSession, ChatMessage, Role } from '../../../domain/Entities/ChatSession';
import fs from 'fs';
import path from 'path';

export class PgChatSessionRepositoryAdapter implements ChatSessionRepositoryPort {
  private pool: Pool;

  constructor(connection: string | Pool) {
    if (typeof connection === 'string') {
      this.pool = new Pool({ connectionString: connection });
    } else {
      this.pool = connection;
    }
  }

  public async init(): Promise<void> {
    // Migration logic moved to external migrate.ts script.
    console.log('[PgChatSession] Adapter initialized (schema check skipped).');
  }

  public async findByUserId(userId: string): Promise<ChatSession | null> {
    const sessionQuery = `
      SELECT id, user_id, started_at 
      FROM chat_session 
      WHERE user_id = $1 
      ORDER BY last_message_at DESC 
      LIMIT 1
    `;
    const sessionResult = await this.pool.query(sessionQuery, [userId]);

    if (sessionResult.rows.length === 0) {
      return null;
    }

    const sessionRow = sessionResult.rows[0];
    const messagesQuery = `
      SELECT role, content, created_at as timestamp 
      FROM chat_message 
      WHERE session_id = $1 
      ORDER BY created_at ASC
    `;
    const messagesResult = await this.pool.query(messagesQuery, [sessionRow.id]);

    const messages = messagesResult.rows.map(row => ({
      role: row.role as Role,
      content: row.content,
      timestamp: row.timestamp
    }));

    return new ChatSession(
      sessionRow.id,
      sessionRow.user_id,
      sessionRow.started_at,
      messages
    );
  }

  public async save(session: ChatSession): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const upsertSessionQuery = `
        INSERT INTO chat_session (id, user_id, started_at, last_message_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET last_message_at = CURRENT_TIMESTAMP
      `;
      await client.query(upsertSessionQuery, [session.id, session.userId, session.startedAt]);

      // Simple sync: delete and re-insert messages
      await client.query('DELETE FROM chat_message WHERE session_id = $1', [session.id]);

      const messages = session.getMessages();
      for (const msg of messages) {
        const insertMessageQuery = `
          INSERT INTO chat_message (session_id, role, content, created_at)
          VALUES ($1, $2, $3, $4)
        `;
        await client.query(insertMessageQuery, [session.id, msg.role, msg.content, msg.timestamp]);
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  public async clear(userId: string): Promise<void> {
    await this.pool.query('DELETE FROM chat_session WHERE user_id = $1', [userId]);
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
