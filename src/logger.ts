/**
 * Logger
 * 
 * Structured logging system with different log levels
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  context?: Record<string, unknown>;
}

export class Logger {
  private level: LogLevel;
  private prefix?: string;

  constructor(level: LogLevel = LogLevel.INFO, prefix?: string) {
    this.level = level;
    this.prefix = prefix;
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.level);
    const requestedLevelIndex = levels.indexOf(level);
    return requestedLevelIndex >= currentLevelIndex;
  }

  /**
   * Format log entry
   */
  private formatEntry(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
    return {
      level,
      timestamp: new Date().toISOString(),
      message: this.prefix ? `[${this.prefix}] ${message}` : message,
      context,
    };
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    const output = JSON.stringify(entry);
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        if (this.shouldLog(LogLevel.DEBUG)) {
          console.debug(output);
        }
        break;
      case LogLevel.INFO:
        if (this.shouldLog(LogLevel.INFO)) {
          console.info(output);
        }
        break;
      case LogLevel.WARN:
        if (this.shouldLog(LogLevel.WARN)) {
          console.warn(output);
        }
        break;
      case LogLevel.ERROR:
        if (this.shouldLog(LogLevel.ERROR)) {
          console.error(output);
        }
        break;
    }
  }

  /**
   * Debug log
   */
  debug(message: string, context?: Record<string, unknown>): void {
    const entry = this.formatEntry(LogLevel.DEBUG, message, context);
    this.output(entry);
  }

  /**
   * Info log
   */
  info(message: string, context?: Record<string, unknown>): void {
    const entry = this.formatEntry(LogLevel.INFO, message, context);
    this.output(entry);
  }

  /**
   * Warning log
   */
  warn(message: string, context?: Record<string, unknown>): void {
    const entry = this.formatEntry(LogLevel.WARN, message, context);
    this.output(entry);
  }

  /**
   * Error log
   */
  error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    const errorContext = error ? { 
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
      ...context,
    } : context;
    
    const entry = this.formatEntry(LogLevel.ERROR, message, errorContext);
    this.output(entry);
  }

  /**
   * Create child logger with prefix
   */
  child(prefix: string): Logger {
    return new Logger(this.level, this.prefix ? `${this.prefix}:${prefix}` : prefix);
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger(LogLevel.INFO);

/**
 * Create a named logger
 */
export function createLogger(name: string, level?: LogLevel): Logger {
  return new Logger(level || LogLevel.INFO, name);
}