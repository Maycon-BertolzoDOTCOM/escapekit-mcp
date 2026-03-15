/**
 * Error Handling
 *
 * Custom error classes for better error handling and debugging
 */
/**
 * Base class for all EscapeKit errors
 */
export declare class EscapeKitError extends Error {
    readonly code: string;
    readonly context?: Record<string, unknown>;
    constructor(message: string, code: string, context?: Record<string, unknown>);
    toJSON(): Record<string, unknown>;
}
/**
 * Error raised when code parsing fails
 */
export declare class ParseError extends EscapeKitError {
    constructor(message: string, context?: Record<string, unknown>);
}
/**
 * Error raised when network request fails
 */
export declare class NetworkError extends EscapeKitError {
    constructor(message: string, context?: Record<string, unknown>);
}
/**
 * Error raised when NPM registry query fails
 */
export declare class NPMRegistryError extends NetworkError {
    constructor(message: string, packageName?: string, context?: Record<string, unknown>);
}
/**
 * Error raised when package is not found
 */
export declare class PackageNotFoundError extends NPMRegistryError {
    constructor(packageName: string);
}
/**
 * Error raised when timeout occurs
 */
export declare class TimeoutError extends NetworkError {
    constructor(operation: string, timeout: number, context?: Record<string, unknown>);
}
/**
 * Error raised when configuration is invalid
 */
export declare class ConfigurationError extends EscapeKitError {
    constructor(message: string, configPath?: string);
}
/**
 * Error raised when validation fails
 */
export declare class ValidationError extends EscapeKitError {
    constructor(message: string, field?: string, value?: unknown);
}
/**
 * Error raised when analysis fails
 */
export declare class AnalysisError extends EscapeKitError {
    constructor(message: string, context?: Record<string, unknown>);
}
/**
 * Error raised when code transformation fails
 */
export declare class TransformationError extends EscapeKitError {
    constructor(message: string, operation?: string, context?: {
        sourceCode?: string;
        packageName?: string;
        line?: number;
        column?: number;
        [key: string]: unknown;
    });
}
/**
 * Error raised when file system operations fail
 */
export declare class FileSystemError extends EscapeKitError {
    constructor(message: string, operation?: string, context?: {
        path?: string;
        permissions?: string;
        [key: string]: unknown;
    });
}
/**
 * Type guard to check if an error is an EscapeKit error
 */
export declare function isEscapeKitError(error: unknown): error is EscapeKitError;
/**
 * Get error code from an error
 */
export declare function getErrorCode(error: unknown): string;
/**
 * Get user-friendly error message
 */
export declare function getErrorMessage(error: unknown): string;
//# sourceMappingURL=errors.d.ts.map