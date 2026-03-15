/**
 * Validate tool for MCP server
 * 
 * Provides validate_reality functionality
 */

import { generateId, createSuccessResponse, createErrorResponse, ValidationResult } from '../models/schemas.js';
import { ProjectValidator } from '../validators/ProjectValidator.js';
import { RuntimeValidator } from '../validators/RuntimeValidator.js';
import { E2EValidator } from '../validators/E2EValidator.js';
import { ValidationScorer, ValidationScoreInputs } from '../validators/ValidationScorer.js';
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
    const projectValidator = new ProjectValidator();
    const runtimeValidator = new RuntimeValidator();
    const e2eValidator = new E2EValidator();
    const scorer = new ValidationScorer();

    const scoreInputs: ValidationScoreInputs = {
      validationLevel,
      projectResult: await projectValidator.validate(projectPath)
    };

    let apiLatency = 0;
    let buildTime = 0;
    let webglSupport = false;

    // Run Runtime validation if requested and project exists
    if (validationLevel === 'standard' || validationLevel === 'thorough') {
      const startBuild = Date.now();
      scoreInputs.runtimeResult = await runtimeValidator.validate(projectPath);
      buildTime = Date.now() - startBuild;
    }

    // Run E2E validation if requested and runtime server successfully booted
    if (validationLevel === 'thorough' && scoreInputs.runtimeResult?.serverUrl) {
      scoreInputs.e2eResult = await e2eValidator.validate(scoreInputs.runtimeResult.serverUrl);
      apiLatency = scoreInputs.e2eResult.metrics.loadTimeMs || 0;
      webglSupport = scoreInputs.e2eResult.metrics.hasWebGL || false;
    }

    const scoreResult = scorer.score(scoreInputs);

    const validationId = generateId('validation');

    return createSuccessResponse<ValidationResult>({
      validationId,
      kitId: generateId('kit'),
      overallScore: scoreResult.overallScore,
      metrics: {
        webglSupport,
        bundleSize: 'N/A', // TODO: Implement bundle size calculation in Phase 5
        apiLatency,
        fallbackCount: scoreInputs.projectResult.checks.filter(c => !c.passed).length,
        buildTime,
      },
      issues: scoreResult.recommendations.map(msg => ({
        id: generateId('issue'),
        type: 'unrealistic_assumption',
        severity: 'warning',
        message: msg,
        description: msg,
        file: 'N/A',
        location: { line: 0, column: 0 },
        autoFixable: false
      })),
      readyForProduction: scoreResult.readyForProduction,
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