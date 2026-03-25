import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { LoggerPort } from '../../domain/ports/LoggerPort';
import path from 'path';
import fs from 'fs';

const { combine, timestamp, printf, label } = winston.format;

const logFormat = printf(({ level, message, label, timestamp }) => {
  // Python format: 2024-02-18 00:00:00,000 - name - LEVEL - message
  // Winston timestamp defaults to ISO. We need to format it to match Python's asctime if possible.
  return `${timestamp} - ${label} - ${level.toUpperCase()} - ${message}`;
});

export class WinstonLoggerAdapter implements LoggerPort {
  private logger: winston.Logger;

  constructor(name: string, logFile?: string) {
    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: combine(
          label({ label: name }),
          timestamp({ format: 'YYYY-MM-DD HH:mm:ss,SSS' }),
          logFormat
        ),
      }),
    ];

    if (logFile) {
        const logDir = path.dirname(logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

      transports.push(
        new DailyRotateFile({
          filename: logFile,
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '30d',
          format: combine(
            label({ label: name }),
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss,SSS' }),
            logFormat
          ),
        })
      );
    }

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      transports,
    });
  }

  debug(message: string, ...meta: any[]): void {
    this.logger.debug(message, ...meta);
  }

  info(message: string, ...meta: any[]): void {
    this.logger.info(message, ...meta);
  }

  warn(message: string, ...meta: any[]): void {
    this.logger.warn(message, ...meta);
  }

  error(message: string, ...meta: any[]): void {
    this.logger.error(message, ...meta);
  }
}
