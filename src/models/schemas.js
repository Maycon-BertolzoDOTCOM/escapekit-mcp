/**
 * Core data models and type definitions for EscapeKit MCP
 */
/**
 * Create an error response
 */
export function createErrorResponse(message, code = 'UNKNOWN_ERROR', severity = 'error') {
    return {
        success: false,
        errors: [{ code, message, severity }],
    };
}
/**
 * Create a success response
 */
export function createSuccessResponse(data) {
    return {
        success: true,
        data,
        errors: [],
    };
}
/**
 * Generate a unique ID
 */
export function generateId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
//# sourceMappingURL=schemas.js.map