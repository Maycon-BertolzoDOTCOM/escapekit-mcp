/**
 * Core data models and type definitions for EscapeKit MCP
 */
/**
 * Error severity levels
 */
export type ErrorSeverity = 'error' | 'warning' | 'info';
/**
 * Issue types detected during analysis
 */
export type IssueType = 'ghost_import' | 'mock_api' | 'unrealistic_assumption' | 'security_risk' | 'infinite_loop' | 'postinstall_risk' | 'slopsquat_risk' | 'unicode_risk';
/**
 * Issue location in code
 */
export interface IssueLocation {
    file?: string;
    line: number;
    column?: number;
}
/**
 * Single issue detected during analysis
 */
export interface Issue {
    id: string;
    type: IssueType;
    severity: ErrorSeverity;
    location: IssueLocation;
    message: string;
    description: string;
    suggestion?: string;
    autoFixable: boolean;
}
/**
 * Analysis summary statistics
 */
export interface AnalysisSummary {
    totalIssues: number;
    ghostImports: number;
    mockApis: number;
    unrealisticAssumptions: number;
    securityRisks: number;
    infiniteLoops: number;
}
/**
 * Complete analysis result
 */
export interface AnalysisResult {
    analysisId: string;
    timestamp: string;
    sandboxType?: string;
    language: string;
    summary: AnalysisSummary;
    issues: Issue[];
    confidenceScore: number;
}
/**
 * Error detail in MCP response
 */
export interface ErrorDetail {
    code: string;
    message: string;
    severity: ErrorSeverity;
}
/**
 * Generic MCP response wrapper
 */
export interface MCPResponse<T = unknown> {
    success: boolean;
    data?: T;
    errors: ErrorDetail[];
}
/**
 * Escape kit generation result
 */
export interface EscapeKit {
    escapeId: string;
    analysisId: string;
    outputPath: string;
    targetPlatform: string;
    filesCreated: string[];
    escapeContractPath: string;
    summary: {
        ghostImportsResolved: number;
        polyfillsAdded: number;
        dependenciesInstalled: number;
    };
}
/**
 * Validation metrics
 */
export interface ValidationMetrics {
    webglSupport: boolean;
    bundleSize?: string;
    apiLatency?: number;
    fallbackCount: number;
    buildTime?: number;
}
/**
 * Validation result
 */
export interface ValidationResult {
    validationId: string;
    kitId: string;
    overallScore: number;
    metrics: ValidationMetrics;
    issues: Issue[];
    readyForProduction: boolean;
    timestamp: string;
}
/**
 * Create an error response
 */
export declare function createErrorResponse(message: string, code?: string, severity?: ErrorSeverity): MCPResponse;
/**
 * Create a success response
 */
export declare function createSuccessResponse<T>(data: T): MCPResponse<T>;
/**
 * Generate a unique ID
 */
export declare function generateId(prefix: string): string;
//# sourceMappingURL=schemas.d.ts.map