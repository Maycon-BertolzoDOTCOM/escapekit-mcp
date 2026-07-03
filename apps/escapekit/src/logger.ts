/**
 * Logger
 *
 * Structured logging system with different log levels,
 * context injection, session tracking, and timing utilities.
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
  prefix?: string;
  context?: Record<string, unknown>;
}

interface TimingHandle {
  label: string;
  startTime: number;
}

export class Logger {
  private level: LogLevel;
  private prefix?: string;
  private persistentContext: Record<string, unknown> = {};

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
   * Set persistent context that will be merged into every log entry.
   * Useful for sessionId, projectDir, requestId, etc.
   *
   * Usage:
   *   logger.withContext({ sessionId: 'abc-123', projectDir: '/foo' })
   *   logger.info('Analysis started')
   *   // Output includes sessionId and projectDir automatically
   */
  withContext(ctx: Record<string, unknown>): this {
    this.persistentContext = { ...this.persistentContext, ...ctx };
    return this;
  }

  /**
   * Clear specific keys from persistent context
   */
  clearContext(...keys: string[]): void {
    for (const key of keys) {
      delete this.persistentContext[key];
    }
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
   * Format log entry with persistent context merge
   */
  private formatEntry(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
    const mergedContext =
      Object.keys(this.persistentContext).length > 0 || context
        ? { ...this.persistentContext, ...context }
        : undefined;

    return {
      level,
      timestamp: new Date().toISOString(),
      message: this.prefix ? `[${this.prefix}] ${message}` : message,
      prefix: this.prefix,
      context: mergedContext,
    };
  }

  private output(entry: LogEntry): void {
    const isJson = process.env.ESCAPEKIT_JSON_LOGS === '1';
    let output: string;

    if (isJson) {
      output = JSON.stringify(entry);
    } else {
      const time = entry.timestamp.split('T')[1].split('.')[0];
      const prefix = this.prefix ? `[${this.prefix}] ` : '';
      const contextStr = entry.context && Object.keys(entry.context).length > 0
        ? `\n    ${JSON.stringify(entry.context)}`
        : '';

      const colors = {
        debug: '\x1b[90m', // gray
        info: '\x1b[36m',  // cyan
        warn: '\x1b[33m',  // yellow
        error: '\x1b[31m', // red
        reset: '\x1b[0m'
      };

      const color = colors[entry.level as keyof typeof colors] || colors.reset;
      const levelUpper = entry.level.toUpperCase().padEnd(5);

      output = `${colors.debug}${time}${colors.reset} ${color}${levelUpper}${colors.reset} ${prefix}${entry.message}${contextStr}`;
    }

    switch (entry.level) {
      case LogLevel.DEBUG:
        if (this.shouldLog(LogLevel.DEBUG)) console.debug(output);
        break;
      case LogLevel.INFO:
        if (this.shouldLog(LogLevel.INFO)) console.info(output);
        break;
      case LogLevel.WARN:
        if (this.shouldLog(LogLevel.WARN)) console.warn(output);
        break;
      case LogLevel.ERROR:
        if (this.shouldLog(LogLevel.ERROR)) console.error(output);
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
   * Start a timing operation. Returns a handle to pass to timeEnd().
   *
   * Usage:
   *   const timer = logger.time('analysis')
   *   // ... work ...
   *   logger.timeEnd(timer) // logs "analysis: 1234ms"
   */
  time(label: string): TimingHandle {
    return { label, startTime: performance.now() };
  }

  /**
   * End a timing operation and log the duration.
   * Returns the duration in milliseconds.
   */
  timeEnd(handle: TimingHandle, context?: Record<string, unknown>): number {
    const durationMs = Math.round(performance.now() - handle.startTime);
    this.info(`${handle.label}: ${durationMs}ms`, { durationMs, ...context });
    return durationMs;
  }

  /**
   * Measure an async operation and log the duration.
   *
   * Usage:
   *   const result = await logger.measure('npm-query', () => registry.get(pkg))
   */
  async measure<T>(label: string, operation: () => Promise<T>, context?: Record<string, unknown>): Promise<T> {
    const timer = this.time(label);
    try {
      const result = await operation();
      this.timeEnd(timer, { success: true, ...context });
      return result;
    } catch (error) {
      this.timeEnd(timer, { success: false, ...context });
      throw error;
    }
  }

  /**
   * Create child logger with prefix (inherits persistent context)
   */
  child(prefix: string): Logger {
    const child = new Logger(this.level, this.prefix ? `${this.prefix}:${prefix}` : prefix);
    child.persistentContext = { ...this.persistentContext };
    return child;
  }
}

/**
 * Global context — merged into all loggers created via defaultLogger
 */
let globalContext: Record<string, unknown> = {};

/**
 * Set global context that all loggers will include
 */
export function setGlobalContext(ctx: Record<string, unknown>): void {
  globalContext = { ...globalContext, ...ctx };
}

/**
 * Clear global context keys
 */
export function clearGlobalContext(...keys: string[]): void {
  for (const key of keys) {
    delete globalContext[key];
  }
}

/**
 * Default logger instance with global context
 */
function createDefaultLogger(): Logger {
  const l = new Logger(LogLevel.INFO);
  l.withContext(globalContext);
  return l;
}

export const logger = createDefaultLogger();

/**
 * Create a named logger with optional level and context
 */
export function createLogger(name: string, level?: LogLevel, context?: Record<string, unknown>): Logger {
  const l = new Logger(level || LogLevel.INFO, name);
  l.withContext(globalContext);
  if (context) l.withContext(context);
  return l;
}

/**
 * Create a session logger pre-configured with sessionId and projectDir
 */
export function createSessionLogger(sessionId: string, projectDir?: string): Logger {
  const l = new Logger(LogLevel.INFO, 'session');
  l.withContext({ sessionId, projectDir, ...globalContext });
  return l;
}
