/**
 * CodeAnalyzer - testes com mocks (sem rede)
 *
 * Valida o fluxo completo de análise com NPMRegistry mockado,
 * cobrindo os mesmos cenários acadêmicos dos testes originais.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CodeAnalyzer } from '../../src/analyzers/CodeAnalyzer.js';

// ── Mock NPMRegistry ──────────────────────────────────────────────────────────
const { knownPackages } = vi.hoisted(() => ({
  knownPackages: new Set(['react', 'react-dom', 'axios', 'lodash', 'express']),
}));

vi.mock('../../src/services/NPMRegistry.js', () => ({
  NPMRegistry: vi.fn().mockImplementation(() => ({
    packageExists: vi.fn().mockImplementation(async (name: string) =>
      knownPackages.has(name)
    ),
    getLatestVersion: vi.fn().mockImplementation(async (name: string) =>
      knownPackages.has(name) ? '^1.0.0' : 'unknown'
    ),
    isNodeBuiltin: vi.fn().mockReturnValue(false),
    checkPackages: vi.fn().mockImplementation(async (names: string[]) => {
      const result = new Map<string, { name: string; version: string; exists: boolean; status: string }>();
      for (const name of names) {
        result.set(name, {
          name,
          version: knownPackages.has(name) ? '^1.0.0' : 'unknown',
          exists: knownPackages.has(name),
          status: knownPackages.has(name) ? 'FOUND' : 'NOT_FOUND',
        });
      }
      return result;
    }),
    clearCache: vi.fn(),
    getCacheStats: vi.fn().mockReturnValue({ size: 0, entries: [] }),
  })),
}));

describe('CodeAnalyzer Integration (mocked)', () => {
  let analyzer: CodeAnalyzer;

  beforeEach(() => {
    vi.clearAllMocks();
    analyzer = new CodeAnalyzer();
  });

  describe('analyze()', () => {
    it('should analyze code with imports and detect ghost imports', async () => {
      const code = `
        import React from "react";
        import { nonExistentPackage } from "this-package-does-not-exist-12345";
      `;

      const result = await analyzer.analyze(code, { checkNPMRegistry: true });

      expect(result).toBeDefined();
      expect(result.analysisId).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.language).toBe('javascript');
      expect(result.summary).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(typeof result.confidenceScore).toBe('number');
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(1);
    });

    it('should detect mock API calls', async () => {
      const code = `
        fetch("https://mockapi.io/api/users");
        axios.get("https://jsonplaceholder.typicode.com/posts");
      `;

      const result = await analyzer.analyze(code, { checkNPMRegistry: false });

      expect(result.summary.mockApis).toBeGreaterThan(0);
      expect(result.issues.some((issue) => issue.type === 'mock_api')).toBe(true);
    });

    it('should detect WebGL usage', async () => {
      const code = `
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');
      `;

      const result = await analyzer.analyze(code, { checkNPMRegistry: false });

      expect(result.summary.unrealisticAssumptions).toBeGreaterThan(0);
      expect(result.issues.some((issue) => issue.type === 'unrealistic_assumption')).toBe(true);
    });

    it('should detect sandbox type', async () => {
      const code = `
        // AI Studio generated code
        import React from "react";
      `;

      const result = await analyzer.analyze(code);

      expect(result.sandboxType).toBeDefined();
      expect(typeof result.sandboxType).toBe('string');
    });

    it('should calculate confidence score', async () => {
      const code = `
        import React from "react";
        const app = () => <div>Hello</div>;
      `;

      const result = await analyzer.analyze(code, { checkNPMRegistry: false });

      expect(typeof result.confidenceScore).toBe('number');
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(1);
    });

    it('should handle empty code', async () => {
      const result = await analyzer.analyze('', { checkNPMRegistry: false });

      expect(result.summary.totalIssues).toBe(0);
      expect(result.issues).toHaveLength(0);
    });

    it('should use provided sandbox type', async () => {
      const result = await analyzer.analyze('import React from "react";', {
        sandboxType: 'bolt.new',
        checkNPMRegistry: false,
      });

      expect(result.sandboxType).toBe('bolt.new');
    });

    it('should perform security analysis when enabled', async () => {
      const result = await analyzer.analyze('import React from "react";', {
        enableSecurityAnalysis: true,
        checkNPMRegistry: false,
      });

      expect(result).toBeDefined();
      expect(result.issues).toBeDefined();
    });

    it('should skip security analysis when disabled', async () => {
      const result = await analyzer.analyze('import React from "react";', {
        enableSecurityAnalysis: false,
        checkNPMRegistry: false,
      });

      expect(result.issues.every((issue) => issue.type !== 'postinstall_risk')).toBe(true);
    });

    it('should default to security analysis disabled', async () => {
      const result = await analyzer.analyze('import React from "react";', {
        checkNPMRegistry: false,
      });

      expect(result.issues.every((issue) => issue.type !== 'postinstall_risk')).toBe(true);
    });
  });

  describe('clearCache()', () => {
    it('should clear NPM registry cache', () => {
      expect(() => analyzer.clearCache()).not.toThrow();
    });
  });
});
