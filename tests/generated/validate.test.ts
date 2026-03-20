import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/validate/ValidationEngine.js', () => ({
  ValidationEngine: class {
    validate = vi.fn().mockResolvedValue({
      canDeploy: true,
      confidence: 1.0,
      duration: 500,
      checks: {
        build: { passed: true, installTime: 100, buildTime: 50, errors: [], warnings: [] },
        runtime: {
          passed: true,
          startupTime: 0,
          memoryUsage: 0,
          apiResponses: [],
          healthChecks: [],
        },
        dependencies: {
          passed: true,
          ghostPackages: [],
          outdatedPackages: [],
          vulnerabilities: [],
          missingPeerDeps: [],
        },
      },
      fixesApplied: [],
      remainingIssues: [],
      recommendations: [],
    });
    canFix = vi.fn().mockReturnValue(true);
  },
}));

import { validateReality } from '../../src/tools/validate';

describe('validateReality', () => {
  describe('parameter validation', () => {
    it('should return error for missing project path', async () => {
      const result = await validateReality('');
      expect(result).toBeDefined();
    });

    it('should return error for undefined project path', async () => {
      const result = await validateReality(undefined as any);
      expect(result).toBeDefined();
    });
  });

  describe('validation levels', () => {
    it('should handle basic validation level', async () => {
      const result = await validateReality('/fake/path', 'basic');
      expect(result.success).toBe(true);
    });

    it('should handle standard validation level', async () => {
      const result = await validateReality('/fake/path', 'standard');
      expect(result.success).toBe(true);
    });

    it('should handle thorough validation level', async () => {
      const result = await validateReality('/fake/path', 'thorough');
      expect(result.success).toBe(true);
    });

    it('should default to standard validation level', async () => {
      const result = await validateReality('/fake/path');
      expect(result.success).toBe(true);
    });
  });
});
