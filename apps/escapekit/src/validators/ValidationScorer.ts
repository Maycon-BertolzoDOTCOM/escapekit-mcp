/**
 * ValidationScorer - Calculates a final confidence score for a generated project
 * 
 * Aggregates the results from ProjectValidator, RuntimeValidator, and E2EValidator
 * to determine an overall confidence score (0.0 - 1.0) and whether the project
 * is safe to deploy to production.
 */

import { ProjectValidationResult } from './ProjectValidator.js';
import { RuntimeValidationResult } from './RuntimeValidator.js';
import { E2EValidationResult } from './E2EValidator.js';
import { logger } from '../logger.js';

export interface ValidationScoreInputs {
  projectResult: ProjectValidationResult;
  runtimeResult?: RuntimeValidationResult;
  e2eResult?: E2EValidationResult;
  validationLevel: 'basic' | 'standard' | 'thorough';
}

export interface ValidationScoreResult {
  overallScore: number;
  readyForProduction: boolean;
  recommendations: string[];
}

export class ValidationScorer {
  private readonly log = logger.child('ValidationScorer');

  /**
   * Weights for different aspects of validation
   */
  private readonly WEIGHTS = {
    STATIC_CHECKS: 0.4,
    DEPENDENCY_INSTALL: 0.2,
    DEV_SERVER_BOOT: 0.2,
    E2E_UI_RENDER: 0.2
  };

  /**
   * Calculates the final validation score based on all available metrics.
   */
  score(inputs: ValidationScoreInputs): ValidationScoreResult {
    this.log.info('Calculating validation score', { validationLevel: inputs.validationLevel });

    const recommendations: string[] = [];
    let score = 0;
    
    // 1. Static Project validation (Weight: 40%)
    const projectScore = inputs.projectResult.summary.total > 0 
      ? inputs.projectResult.summary.passed / inputs.projectResult.summary.total 
      : 0;
    
    score += projectScore * this.WEIGHTS.STATIC_CHECKS;

    if (projectScore < 1.0) {
      inputs.projectResult.checks
        .filter(c => !c.passed)
        .forEach(c => recommendations.push(`Fix structural/syntax issue: ${c.message}`));
    }

    // 2. Runtime validation (Install + Boot)
    if (inputs.validationLevel === 'standard' || inputs.validationLevel === 'thorough') {
      if (!inputs.runtimeResult) {
        recommendations.push('Runtime validation requested but result is missing');
      } else {
        if (inputs.runtimeResult.installSuccess) {
          score += this.WEIGHTS.DEPENDENCY_INSTALL;
        } else {
          recommendations.push(`Fix npm install failure: ${inputs.runtimeResult.error}`);
        }

        if (inputs.runtimeResult.bootSuccess) {
          score += this.WEIGHTS.DEV_SERVER_BOOT;
        } else {
          recommendations.push(`Fix dev server boot failure: ${inputs.runtimeResult.error}`);
        }
      }
    } else {
      // If only basic validation run, distribute the remaining 60% weight if project is 100% valid?
      // No, basic validation maxes out at score 0.4, representing low confidence compared to full E2E.
      recommendations.push('Run at least standard validation (npm install/run dev) to increase confidence');
    }

    // 3. E2E Browser validation
    if (inputs.validationLevel === 'thorough') {
      if (!inputs.e2eResult) {
        recommendations.push('E2E validation requested but result is missing');
      } else {
        if (inputs.e2eResult.valid) {
          score += this.WEIGHTS.E2E_UI_RENDER;
        } else {
          if (!inputs.e2eResult.pageLoaded) {
            recommendations.push('Fix browser page load failure (HTTP 500 or timeout)');
          }
          if (inputs.e2eResult.jsErrors.length > 0) {
            recommendations.push(`Fix catastrophic JS errors in browser: ${inputs.e2eResult.jsErrors[0]}`);
          }
        }
        
        // Add recommendations for non-fatal issues
        if (inputs.e2eResult.consoleErrors.length > 0) {
          recommendations.push('Investigate non-fatal browser console errors');
        }
      }
    } else if (inputs.validationLevel === 'standard') {
      recommendations.push('Run thorough validation (Playwright E2E) to verify UI rendering and increase confidence');
    }

    // Normalize to handle float precision issues
    const overallScore = Math.min(Math.max(Math.round(score * 100) / 100, 0), 1);

    // Determine production readiness
    let isE2EValid = true;
    if (inputs.validationLevel === 'thorough' && inputs.e2eResult && !inputs.e2eResult.valid) {
      isE2EValid = false;
    }

    const readyForProduction = overallScore >= 0.8 && inputs.projectResult.valid && 
      (inputs.runtimeResult ? inputs.runtimeResult.valid : false) && isE2EValid;

    this.log.info('Validation score calculation complete', { overallScore, readyForProduction });

    return {
      overallScore,
      readyForProduction,
      recommendations
    };
  }
}
