-- Migration 001: Create system_task table and trigger for RAG indexing
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS system_task (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    queue_name TEXT NOT NULL DEFAULT 'default',
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    run_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    locked_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    
    error_message TEXT,
    
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_system_task_fetch_next ON system_task (run_at, status) 
WHERE status = 'pending';

-- Notify function
CREATE OR REPLACE FUNCTION notify_system_task_queued()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('system_task_queued', NEW.id::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS trg_notify_system_task_queued ON system_task;
CREATE TRIGGER trg_notify_system_task_queued
AFTER INSERT ON system_task
FOR EACH ROW
EXECUTE FUNCTION notify_system_task_queued();
