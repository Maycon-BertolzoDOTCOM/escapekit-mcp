/**
 * ConfidenceCalculator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConfidenceCalculator, createConfidenceCalculator } from '../../src/utils/ConfidenceCalculator.js';
import { type Issue } from '../../src/models/schemas.js';

describe('ConfidenceCalculator', () => {
  let calculator: ConfidenceCalculator;

  beforeEach(() => {
    calculator = createConfidenceCalculator();
  });

  const createIssue = (overrides?: Partial<Issue>): Issue => ({
    id: 'test-issue-1',
    type: 'ghost_import',
    severity: 'error',
    location: { line: 1, column: 1 },
    message: 'Test issue',
    description: 'Test description',
    autoFixable: false,
    ...overrides,
  });

  describe('calculate', () => {
    it('should return perfect score for no issues', () => {
      const result = calculator.calculate([]);
      
      expect(result.score).toBe(1.0);
      expect(result.level).toBe('excellent');
      expect(result.criticalIssues).toBe(0);
      expect(result.errorIssues).toBe(0);
      expect(result.warningIssues).toBe(0);
    });

    it('should handle single ghost import (critical issue)', () => {
      const issues = [
        createIssue({
          type: 'ghost_import',
          severity: 'error',
          message: 'Ghost import detected',
        }),
      ];
      
      const result = calculator.calculate(issues);
      
      expect(result.score).toBeLessThan(0.8);
      expect(result.criticalIssues).toBe(1);
      expect(result.errorIssues).toBe(1);
      expect(result.level).not.toBe('excellent');
    });

    it('should handle single mock API (warning)', () => {
      const issues = [
        createIssue({
          type: 'mock_api',
          severity: 'warning',
          message: 'Mock API detected',
        }),
      ];
      
      const result = calculator.calculate(issues);
      
      expect(result.score).toBeGreaterThan(0.8);
      expect(result.warningIssues).toBe(1);
      expect(result.criticalIssues).toBe(0);
    });

    it('should handle single WebGL usage (warning)', () => {
      const issues = [
        createIssue({
          type: 'unrealistic_assumption',
          severity: 'warning',
          message: 'WebGL usage detected',
        }),
      ];
      
      const result = calculator.calculate(issues);
      
      expect(result.score).toBeGreaterThan(0.8);
      expect(result.warningIssues).toBe(1);
    });

    it('should handle security risk (critical)', () => {
      const issues = [
        createIssue({
          type: 'security_risk',
          severity: 'error',
          message: 'Security risk detected',
        }),
      ];
      
      const result = calculator.calculate(issues);
      
      expect(result.score).toBeLessThan(0.8);
      expect(result.criticalIssues).toBe(1);
      expect(result.errorIssues).toBe(1);
    });

    it('should calculate score decreasing with more issues', () => {
      const issues1 = [createIssue()];
      const issues3 = [
        createIssue(),
        createIssue(),
        createIssue(),
      ];
      
      const result1 = calculator.calculate(issues1);
      const result3 = calculator.calculate(issues3);
      
      expect(result3.score).toBeLessThan(result1.score);
    });

    it('should have higher penalty for errors than warnings', () => {
      const errors = [
        createIssue({ type: 'ghost_import', severity: 'error' }),
        createIssue({ type: 'ghost_import', severity: 'error' }),
      ];
      
      const warnings = [
        createIssue({ type: 'mock_api', severity: 'warning' }),
        createIssue({ type: 'mock_api', severity: 'warning' }),
      ];
      
      const errorResult = calculator.calculate(errors);
      const warningResult = calculator.calculate(warnings);
      
      expect(errorResult.score).toBeLessThan(warningResult.score);
    });

    it('should correctly count issues by type', () => {
      const issues = [
        createIssue({ type: 'ghost_import', severity: 'error' }),
        createIssue({ type: 'ghost_import', severity: 'error' }),
        createIssue({ type: 'mock_api', severity: 'warning' }),
        createIssue({ type: 'unrealistic_assumption', severity: 'warning' }),
        createIssue({ type: 'unrealistic_assumption', severity: 'warning' }),
        createIssue({ type: 'security_risk', severity: 'error' }),
      ];
      
      const result = calculator.calculate(issues);
      
      expect(result.breakdown.ghost_import).toBe(2);
      expect(result.breakdown.mock_api).toBe(1);
      expect(result.breakdown.unrealistic_assumption).toBe(2);
      expect(result.breakdown.security_risk).toBe(1);
      expect(result.breakdown.infinite_loop).toBe(0);
    });

    it('should calculate correct confidence levels', () => {
      const noIssues = calculator.calculate([]);
      expect(noIssues.level).toBe('excellent');
      
      const goodCode = calculator.calculate([
        createIssue({ type: 'mock_api', severity: 'warning' }),
      ]);
      expect(goodCode.level).toBe('high');
      
      const okCode = calculator.calculate([
        createIssue({ type: 'mock_api', severity: 'warning' }),
        createIssue({ type: 'unrealistic_assumption', severity: 'warning' }),
        createIssue({ type: 'unrealistic_assumption', severity: 'warning' }),
      ]);
      expect(okCode.level).toBe('medium');
      
      const badCode = calculator.calculate([
        createIssue({ type: 'ghost_import', severity: 'error' }),
        createIssue({ type: 'ghost_import', severity: 'error' }),
        createIssue({ type: 'mock_api', severity: 'warning' }),
      ]);
      expect(badCode.level).toBe('critical'); // Two ghost imports with warnings results in critical
      
      const criticalCode = calculator.calculate([
        createIssue({ type: 'ghost_import', severity: 'error' }),
        createIssue({ type: 'security_risk', severity: 'error' }),
        createIssue({ type: 'ghost_import', severity: 'error' }),
        createIssue({ type: 'ghost_import', severity: 'error' }),
        createIssue({ type: 'ghost_import', severity: 'error' }),
      ]);
      expect(criticalCode.level).toBe('critical');
    });
  });

  describe('getRecommendations', () => {
    it('should provide critical recommendations', () => {
      const metrics = {
        score: 0.05,
        criticalIssues: 2,
        errorIssues: 3,
        warningIssues: 1,
        breakdown: {
          ghost_import: 2,
          mock_api: 1,
          unrealistic_assumption: 0,
          security_risk: 0,
          infinite_loop: 0,
        },
        level: 'critical' as const,
      };
      
      const recommendations = calculator.getRecommendations(metrics);
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('🚨'))).toBe(true);
      expect(recommendations.some(r => r.includes('critical'))).toBe(true);
    });

    it('should provide low confidence recommendations', () => {
      const metrics = {
        score: 0.25,
        criticalIssues: 1,
        errorIssues: 2,
        warningIssues: 2,
        breakdown: {
          ghost_import: 1,
          mock_api: 1,
          unrealistic_assumption: 1,
          security_risk: 0,
          infinite_loop: 0,
        },
        level: 'low' as const,
      };
      
      const recommendations = calculator.getRecommendations(metrics);
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('⚠️'))).toBe(true);
      expect(recommendations.some(r => r.includes('modifications'))).toBe(true);
    });

    it('should provide medium confidence recommendations', () => {
      const metrics = {
        score: 0.5,
        criticalIssues: 0,
        errorIssues: 1,
        warningIssues: 3,
        breakdown: {
          ghost_import: 1,
          mock_api: 2,
          unrealistic_assumption: 1,
          security_risk: 0,
          infinite_loop: 0,
        },
        level: 'medium' as const,
      };
      
      const recommendations = calculator.getRecommendations(metrics);
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('📝'))).toBe(true);
      expect(recommendations.some(r => r.includes('improvements'))).toBe(true);
    });

    it('should provide high confidence recommendations', () => {
      const metrics = {
        score: 0.75,
        criticalIssues: 0,
        errorIssues: 0,
        warningIssues: 2,
        breakdown: {
          ghost_import: 0,
          mock_api: 1,
          unrealistic_assumption: 1,
          security_risk: 0,
          infinite_loop: 0,
        },
        level: 'high' as const,
      };
      
      const recommendations = calculator.getRecommendations(metrics);
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('✅'))).toBe(true);
      expect(recommendations.some(r => r.includes('good shape'))).toBe(true);
    });

    it('should provide excellent confidence recommendations', () => {
      const metrics = {
        score: 0.95,
        criticalIssues: 0,
        errorIssues: 0,
        warningIssues: 0,
        breakdown: {
          ghost_import: 0,
          mock_api: 0,
          unrealistic_assumption: 0,
          security_risk: 0,
          infinite_loop: 0,
        },
        level: 'excellent' as const,
      };
      
      const recommendations = calculator.getRecommendations(metrics);
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('🎉'))).toBe(true);
      expect(recommendations.some(r => r.includes('production-ready'))).toBe(true);
    });
  });

  describe('getDescription', () => {
    it('should return description for critical level', () => {
      const metrics = {
        score: 0,
        criticalIssues: 1,
        errorIssues: 1,
        warningIssues: 0,
        breakdown: {
          ghost_import: 1,
          mock_api: 0,
          unrealistic_assumption: 0,
          security_risk: 0,
          infinite_loop: 0,
        },
        level: 'critical' as const,
      };
      
      const description = calculator.getDescription(metrics);
      
      expect(description).toContain('will not work');
      expect(description).toContain('immediate attention');
    });

    it('should return description for low level', () => {
      const metrics = {
        score: 0.25,
        criticalIssues: 0,
        errorIssues: 2,
        warningIssues: 1,
        breakdown: {
          ghost_import: 0,
          mock_api: 1,
          unrealistic_assumption: 1,
          security_risk: 0,
          infinite_loop: 0,
        },
        level: 'low' as const,
      };
      
      const description = calculator.getDescription(metrics);
      
      expect(description).toContain('significant issues');
    });

    it('should return description for medium level', () => {
      const metrics = {
        score: 0.5,
        criticalIssues: 0,
        errorIssues: 1,
        warningIssues: 2,
        breakdown: {
          ghost_import: 0,
          mock_api: 1,
          unrealistic_assumption: 2,
          security_risk: 0,
          infinite_loop: 0,
        },
        level: 'medium' as const,
      };
      
      const description = calculator.getDescription(metrics);
      
      expect(description).toContain('some issues');
      expect(description).toContain('modifications');
    });

    it('should return description for high level', () => {
      const metrics = {
        score: 0.75,
        criticalIssues: 0,
        errorIssues: 0,
        warningIssues: 1,
        breakdown: {
          ghost_import: 0,
          mock_api: 1,
          unrealistic_assumption: 0,
          security_risk: 0,
          infinite_loop: 0,
        },
        level: 'high' as const,
      };
      
      const description = calculator.getDescription(metrics);
      
      expect(description).toContain('mostly ready');
      expect(description).toContain('minor issues');
    });

    it('should return description for excellent level', () => {
      const metrics = {
        score: 0.95,
        criticalIssues: 0,
        errorIssues: 0,
        warningIssues: 0,
        breakdown: {
          ghost_import: 0,
          mock_api: 0,
          unrealistic_assumption: 0,
          security_risk: 0,
          infinite_loop: 0,
        },
        level: 'excellent' as const,
      };
      
      const description = calculator.getDescription(metrics);
      
      expect(description).toContain('excellent condition');
      expect(description).toContain('production-ready');
    });
  });
});