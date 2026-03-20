/**
 * Sistema de logging com níveis configuráveis
 * Suporta: debug, info, warn, error
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface LoggerOptions {
  level: LogLevel;
  prefix?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

class Logger {
  private level: LogLevel = 'info';
  private prefix: string = '';

  constructor(options?: Partial<LoggerOptions>) {
    if (options?.level) {
      this.level = options.level;
    }
    if (options?.prefix) {
      this.prefix = options.prefix;
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.level];
  }

  private format(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const levelStr = level.toUpperCase().padEnd(5);
    const prefix = this.prefix ? `[${this.prefix}] ` : '';
    return `${timestamp} ${levelStr} ${prefix}${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.format('debug', message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(this.format('info', message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.format('warn', message), ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.format('error', message), ...args);
    }
  }

  success(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(`✅ ${message}`, ...args);
    }
  }

  infoColored(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(`ℹ️  ${message}`, ...args);
    }
  }

  warnColored(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`⚠️  ${message}`, ...args);
    }
  }

  debugColored(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(`🔍 ${message}`, ...args);
    }
  }
}

// Singleton logger instance
let logger: Logger | null = null;

export function getLogger(options?: Partial<LoggerOptions>): Logger {
  if (!logger) {
    logger = new Logger(options);
  }
  return logger;
}

export function createLogger(options?: Partial<LoggerOptions>): Logger {
  return new Logger(options);
}

// Função helper para parsear log level de string
export function parseLogLevel(value: string | undefined): LogLevel {
  if (!value) return 'info';
  
  const normalized = value.toLowerCase() as LogLevel;
  if (normalized in LOG_LEVELS) {
    return normalized;
  }
  return 'info';
}
