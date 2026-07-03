/**
 * Unit tests for EscapeContractWriter
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { EscapeContractWriter } from '../../src/generators/EscapeContractWriter.js';
import { FileSystemError } from '../../src/errors.js';
import type { AnalysisResult } from '../../src/models/schemas.js';
import type { EscapeContract } from '../../src/models/transformation.js';
import { ResolutionMethod } from '../../src/models/transformation.js';

function makeAnalysisResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    analysisId: 'analysis-test-123',
    timestamp: new Date().toISOString(),
    sandboxType: 'claude-artifacts',
    language: 'typescript',
    summary: {
      totalIssues: 2,
      ghostImports: 2,
      mockApis: 0,
      unrealisticAssumptions: 0,
      securityRisks: 0,
      infiniteLoops: 0,
    },
    issues: [],
    confidenceScore: 0.9,
    ...overrides,
  };
}

describe('EscapeContractWriter', () => {
  let writer: EscapeContractWriter;
  let tmpDir: string;

  beforeEach(async () => {
    writer = new EscapeContractWriter();
    tmpDir = await mkdtemp(join(tmpdir(), 'escapekit-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('calculateCodeHash()', () => {
    it('returns a sha256: prefixed hash', () => {
      const hash = writer.calculateCodeHash('hello world');
      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('returns consistent hash for same input', () => {
      const code = "import foo from 'bar';";
      expect(writer.calculateCodeHash(code)).toBe(writer.calculateCodeHash(code));
    });

    it('returns different hashes for different inputs', () => {
      expect(writer.calculateCodeHash('abc')).not.toBe(writer.calculateCodeHash('xyz'));
    });

    it('handles empty string', () => {
      const hash = writer.calculateCodeHash('');
      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });
  });

  describe('validate()', () => {
    it('returns true for a valid contract', () => {
      const contract = writer.generate({
        analysisResult: makeAnalysisResult(),
        resolutions: [],
        transformations: [],
      });
      expect(writer.validate(contract)).toBe(true);
    });

    it('returns false for null', () => {
      expect(writer.validate(null)).toBe(false);
    });

    it('returns false for missing contractId', () => {
      const contract = writer.generate({ analysisResult: makeAnalysisResult(), resolutions: [], transformations: [] });
      const bad = { ...contract, contractId: '' };
      expect(writer.validate(bad)).toBe(false);
    });

    it('returns false for missing analysisId', () => {
      const contract = writer.generate({ analysisResult: makeAnalysisResult(), resolutions: [], transformations: [] });
      const bad = { ...contract, analysisId: '' };
      expect(writer.validate(bad)).toBe(false);
    });

    it('returns false for missing origin', () => {
      const contract = writer.generate({ analysisResult: makeAnalysisResult(), resolutions: [], transformations: [] });
      const { origin: _o, ...bad } = contract as any;
      expect(writer.validate(bad)).toBe(false);
    });
  });

  describe('generate()', () => {
    it('creates a contract with correct analysisId', () => {
      const result = makeAnalysisResult({ analysisId: 'my-analysis-id' });
      const contract = writer.generate({ analysisResult: result, resolutions: [], transformations: [] });
      expect(contract.analysisId).toBe('my-analysis-id');
    });

    it('sets validationStatus to PENDING', () => {
      const contract = writer.generate({ analysisResult: makeAnalysisResult(), resolutions: [], transformations: [] });
      expect(contract.validationStatus).toBe('PENDING');
    });

    it('calculates code hash when originalCode provided', () => {
      const contract = writer.generate({
        analysisResult: makeAnalysisResult(),
        resolutions: [],
        transformations: [],
        originalCode: 'const x = 1;',
      });
      expect(contract.origin.originalCodeHash).toMatch(/^sha256:/);
    });

    it('adds low-confidence assumption', () => {
      const contract = writer.generate({
        analysisResult: makeAnalysisResult(),
        resolutions: [{
          originalImport: 'ghost',
          resolvedPackage: 'real',
          version: '1.0.0',
          resolutionMethod: ResolutionMethod.SEMANTIC_ANALYSIS,
          confidence: 0.5,
        }],
        transformations: [],
      });
      expect(contract.assumptions.some(a => a.includes('Low-confidence'))).toBe(true);
    });

    it('sets sandboxType from analysisResult', () => {
      const contract = writer.generate({
        analysisResult: makeAnalysisResult({ sandboxType: 'replit' }),
        resolutions: [],
        transformations: [],
      });
      expect(contract.origin.sandboxType).toBe('replit');
    });
  });

  describe('writeToFile() and parseFromFile()', () => {
    it('round-trips a contract through JSON', async () => {
      const contract = writer.generate({
        analysisResult: makeAnalysisResult(),
        resolutions: [],
        transformations: [],
        originalCode: 'const x = 1;',
      });

      const filePath = join(tmpDir, 'escape-contract.json');
      await writer.writeToFile(contract, filePath);
      const loaded = await writer.parseFromFile(filePath);

      expect(loaded.contractId).toBe(contract.contractId);
      expect(loaded.analysisId).toBe(contract.analysisId);
      expect(loaded.validationStatus).toBe('PENDING');
    });

    it('throws FileSystemError when write path is invalid', async () => {
      const contract = writer.generate({ analysisResult: makeAnalysisResult(), resolutions: [], transformations: [] });
      await expect(writer.writeToFile(contract, '/nonexistent/path/contract.json')).rejects.toThrow(FileSystemError);
    });

    it('throws FileSystemError when read path does not exist', async () => {
      await expect(writer.parseFromFile('/nonexistent/contract.json')).rejects.toThrow(FileSystemError);
    });

    it('throws on invalid JSON content', async () => {
      const filePath = join(tmpDir, 'bad.json');
      const { writeFile } = await import('fs/promises');
      await writeFile(filePath, 'not valid json', 'utf-8');
      await expect(writer.parseFromFile(filePath)).rejects.toThrow();
    });
  });
});
