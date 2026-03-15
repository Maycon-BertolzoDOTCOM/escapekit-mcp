/**
 * Error Handling
 * 
 * Custom error classes for better error handling and debugging
 */

/**
 * Base class for all EscapeKit errors
 */
export class EscapeKitError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;

  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Error raised when code parsing fails
 */
export class ParseError extends EscapeKitError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'PARSE_ERROR', context);
  }
}

/**
 * Error raised when network request fails
 */
export class NetworkError extends EscapeKitError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'NETWORK_ERROR', context);
  }
}

/**
 * Error raised when NPM registry query fails
 */
export class NPMRegistryError extends NetworkError {
  constructor(message: string, packageName?: string, context?: Record<string, unknown>) {
    super(message, { packageName, ...context });
  }
}

/**
 * Error raised when package is not found
 */
export class PackageNotFoundError extends NPMRegistryError {
  constructor(packageName: string) {
    super(`Package "${packageName}" not found in registry`, packageName);
  }
}

/**
 * Error raised when timeout occurs
 */
export class TimeoutError extends NetworkError {
  constructor(operation: string, timeout: number, context?: Record<string, unknown>) {
    super(`Operation "${operation}" timed out after ${timeout}ms`, context);
  }
}

/**
 * Error raised when configuration is invalid
 */
export class ConfigurationError extends EscapeKitError {
  constructor(message: string, configPath?: string) {
    super(message, 'CONFIGURATION_ERROR', { configPath });
  }
}

/**
 * Error raised when validation fails
 */
export class ValidationError extends EscapeKitError {
  constructor(message: string, field?: string, value?: unknown) {
    super(message, 'VALIDATION_ERROR', { field, value });
  }
}

/**
 * Error raised when analysis fails
 */
export class AnalysisError extends EscapeKitError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'ANALYSIS_ERROR', context);
  }
}

/**
 * Error raised when code transformation fails
 */
export class TransformationError extends EscapeKitError {
  constructor(
    message: string,
    operation?: string,
    context?: {
      sourceCode?: string;
      packageName?: string;
      line?: number;
      column?: number;
      [key: string]: unknown;
    }
  ) {
    super(message, 'TRANSFORMATION_ERROR', { operation, ...context });
  }
}

/**
 * Error raised when file system operations fail
 */
export class FileSystemError extends EscapeKitError {
  constructor(
    message: string,
    operation?: string,
    context?: {
      path?: string;
      permissions?: string;
      [key: string]: unknown;
    }
  ) {
    super(message, 'FILE_SYSTEM_ERROR', { operation, ...context });
  }
}

/**
 * Type guard to check if an error is an EscapeKit error
 */
export function isEscapeKitError(error: unknown): error is EscapeKitError {
  return error instanceof EscapeKitError;
}

/**
 * Get error code from an error
 */
export function getErrorCode(error: unknown): string {
  if (isEscapeKitError(error)) {
    return error.code;
  }
  if (error instanceof Error) {
    return error.name;
  }
  return 'UNKNOWN_ERROR';
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (isEscapeKitError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}