/**
 * Error Utilities
 *
 * Comprehensive error handling toolkit.
 * Inspired by Claude Code's utils/errors.ts.
 */

/**
 * Custom error classes
 */
export class AppError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AbortError extends Error {
  constructor(message?: string) {
    super(message ?? 'Operation aborted');
    this.name = 'AbortError';
  }
}

export class ConfigError extends Error {
  constructor(message: string, public readonly filePath?: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Check if an error is an abort error
 */
export function isAbortError(e: unknown): boolean {
  return (
    e instanceof AbortError ||
    (e instanceof Error && e.name === 'AbortError') ||
    (e instanceof Error && e.name === 'AbortError')
  );
}

/**
 * Normalize unknown to Error
 */
export function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

/**
 * Extract message from unknown error
 */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Get errno code from a Node.js error
 */
export function getErrnoCode(e: unknown): string | undefined {
  if (e && typeof e === 'object' && 'code' in e && typeof e.code === 'string') {
    return e.code;
  }
  return undefined;
}

/**
 * Check if error is ENOENT
 */
export function isENOENT(e: unknown): boolean {
  return getErrnoCode(e) === 'ENOENT';
}

/**
 * Check if a filesystem path is inaccessible
 */
export function isFsInaccessible(e: unknown): boolean {
  const code = getErrnoCode(e);
  return code === 'ENOENT' || code === 'EACCES' || code === 'EPERM' || code === 'ENOTDIR' || code === 'ELOOP';
}

/**
 * Check if error has exact message
 */
export function hasExactMessage(e: unknown, message: string): boolean {
  return e instanceof Error && e.message === message;
}

/**
 * Extract short error stack (top N frames only)
 */
export function shortErrorStack(e: unknown, maxFrames = 5): string {
  if (!(e instanceof Error)) return String(e);
  if (!e.stack) return e.message;

  const lines = e.stack.split('\n');
  const header = lines[0] ?? e.message;
  const frames = lines.slice(1).filter((l) => l.trim().startsWith('at '));

  if (frames.length <= maxFrames) return e.stack;
  return [header, ...frames.slice(0, maxFrames)].join('\n');
}

/**
 * Error kind for HTTP errors
 */
export type HttpErrorKind = 'auth' | 'timeout' | 'network' | 'http' | 'other';

/**
 * Classify an HTTP/axios-like error
 */
export function classifyHttpError(e: unknown): { kind: HttpErrorKind; status?: number; message: string } {
  const message = errorMessage(e);

  if (!e || typeof e !== 'object') {
    return { kind: 'other', message };
  }

  const err = e as { response?: { status?: number }; code?: string };
  const status = err.response?.status;

  if (status === 401 || status === 403) return { kind: 'auth', status, message };
  if (err.code === 'ECONNABORTED') return { kind: 'timeout', status, message };
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') return { kind: 'network', status, message };
  if (status) return { kind: 'http', status, message };
  return { kind: 'other', message };
}

/**
 * Wrap an async function with error normalization
 */
export function withErrorNormalization<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (e) {
      throw toError(e);
    }
  };
}
