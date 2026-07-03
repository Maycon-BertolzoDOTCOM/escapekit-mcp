/**
 * Validate tool for MCP server
 *
 * Provides validate_reality functionality using the Validation Engine.
 */

import {
  generateId,
  createSuccessResponse,
  createErrorResponse,
  ValidationResult,
} from '../models/schemas.js';
import { ValidationEngine } from '../validate/ValidationEngine.js';
import { logger } from '../logger.js';

export async function validateReality(
  projectPath: string,
  validationLevel: 'basic' | 'standard' | 'thorough' = 'standard'
) {
  if (!projectPath) {
    return createErrorResponse('project_path parameter is required', 'MISSING_PARAMETER');
  }

  const log = logger.child('validateReality');
  log.info('Starting validation', { projectPath, validationLevel });

  try {
    const engine = new ValidationEngine();

    const result = await engine.validate(projectPath, {
      level: validationLevel,
      environment: 'local',
      autoFix: false,
      timeout: 300000,
    });

    const validationId = generateId('validation');

    return createSuccessResponse<ValidationResult>({
      validationId,
      kitId: generateId('kit'),
      overallScore: result.confidence,
      metrics: {
        webglSupport: result.checks.webgl?.hasWebGL ?? false,
        bundleSize: result.checks.build.bundleSize
          ? `${(result.checks.build.bundleSize / 1024).toFixed(0)}KB`
          : 'N/A',
        apiLatency: result.checks.runtime.apiResponses[0]?.latencyMs ?? 0,
        fallbackCount: result.remainingIssues.filter(i => i.severity === 'error').length,
        buildTime: result.checks.build.buildTime,
      },
      issues: result.remainingIssues.map(issue => ({
        id: generateId('issue'),
        type:
          issue.type === 'BUILD_ERROR'
            ? ('unrealistic_assumption' as const)
            : issue.type === 'GHOST_IMPORT'
              ? ('ghost_import' as const)
              : issue.type === 'SECURITY_VULNERABILITY'
                ? ('security_risk' as const)
                : ('unrealistic_assumption' as const),
        severity: issue.severity,
        message: issue.message,
        description: issue.suggestion || issue.message,
        file: issue.file || 'N/A',
        location: { line: issue.line || 0, column: 0 },
        autoFixable: engine.canFix(issue.type),
      })),
      readyForProduction: result.canDeploy,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Validation failed unexpectedly', { error });
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error during validation',
      'VALIDATION_ERROR'
    );
  }
}
