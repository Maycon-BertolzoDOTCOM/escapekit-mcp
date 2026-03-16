import { describe, it, expect, vi } from 'vitest';
import { VitestAdapter } from '../../src/adapters/vitest-adapter';
import { TestResult } from '../../src/adapters/index';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

describe('VitestAdapter', () => {
  let adapter: VitestAdapter;
  const testFilePath = join(process.cwd(), 'test-vitest-output.json');

  beforeEach(() => {
    adapter = new VitestAdapter();
    if (existsSync(testFilePath)) {
      unlinkSync(testFilePath);
    }
  });

  afterEach(() => {
    if (existsSync(testFilePath)) {
      unlinkSync(testFilePath);
    }
  });

  describe('canHandle', () => {
    it('should identify Vitest JSON files correctly', () => {
      const vitestJson = JSON.stringify({
        testResults: [
          {
            name: 'Test File',
            filepath: '/path/to/test.ts',
            result: { state: 'pass' },
            tests: [],
          },
        ],
      });

      writeFileSync(testFilePath, vitestJson);
      expect(adapter.canHandle(testFilePath)).toBe(true);
    });

    it('should reject non-Vitest JSON files', () => {
      const nonVitestJson = JSON.stringify({
        some: 'other',
        structure: 'format',
      });

      writeFileSync(testFilePath, nonVitestJson);
      expect(adapter.canHandle(testFilePath)).toBe(false);
    });

    it('should reject non-JSON files', () => {
      expect(adapter.canHandle('test.txt')).toBe(false);
    });
  });

  describe('getFrameworkName', () => {
    it('should return correct framework name', () => {
      expect(adapter.getFrameworkName()).toBe('vitest');
    });
  });

  describe('load', () => {
    it('should parse Vitest JSON output with passed tests', async () => {
      const vitestOutput: any = {
        testResults: [
          {
            name: 'Test Suite',
            filepath: '/path/to/test.ts',
            result: { state: 'pass', duration: 42 },
            tests: [
              {
                name: 'should pass',
                filepath: '/path/to/test.ts',
                result: { state: 'pass', duration: 10 },
              },
              {
                name: 'should also pass',
                filepath: '/path/to/test.ts',
                result: { state: 'pass', duration: 15 },
              },
            ],
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(vitestOutput));

      expect(results).toHaveLength(3);
      expect(results.every(r => r.outcome === 'passed')).toBe(true);
      expect(results[0].duration).toBe(42);
      expect(results[1].duration).toBe(10);
      expect(results[2].duration).toBe(15);
    });

    it('should parse Vitest JSON output with failed tests', async () => {
      const vitestOutput: any = {
        testResults: [
          {
            name: 'Test Suite',
            filepath: '/path/to/test.ts',
            result: { state: 'pass' },
            tests: [
              {
                name: 'should pass',
                filepath: '/path/to/test.ts',
                result: { state: 'pass' },
              },
              {
                name: 'should fail',
                filepath: '/path/to/test.ts',
                result: {
                  state: 'fail',
                  error: {
                    message: 'Test failed',
                    stack: 'Error: Test failed\n    at test.ts:10',
                  },
                },
              },
            ],
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(vitestOutput));

      const failedTest = results.find(r => r.outcome === 'failed');
      expect(failedTest).toBeDefined();
      expect(failedTest?.testCase).toContain('should-fail');
      expect(failedTest?.error).toContain('Test failed');
      expect(failedTest?.error).toContain('test.ts:10');
    });

    it('should parse Vitest JSON output with skipped tests', async () => {
      const vitestOutput: any = {
        testResults: [
          {
            name: 'Test Suite',
            filepath: '/path/to/test.ts',
            result: { state: 'pass' },
            tests: [
              {
                name: 'should skip',
                filepath: '/path/to/test.ts',
                result: { state: 'skip' },
              },
            ],
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(vitestOutput));

      expect(results).toHaveLength(2);
      const skippedTest = results.find(r => r.outcome === 'skipped');
      expect(skippedTest).toBeDefined();
      expect(skippedTest?.metadata?.originalStatus).toBe('skip');
    });

    it('should filter out skipped tests when configured', async () => {
      adapter = new VitestAdapter({ includeSkipped: false });

      const vitestOutput: any = {
        testResults: [
          {
            name: 'Test Suite',
            filepath: '/path/to/test.ts',
            result: { state: 'pass' },
            tests: [
              {
                name: 'should skip',
                filepath: '/path/to/test.ts',
                result: { state: 'skip' },
              },
            ],
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(vitestOutput));

      const skippedTest = results.find(r => r.outcome === 'skipped');
      expect(skippedTest).toBeUndefined();
    });

    it('should normalize test case names correctly', async () => {
      const vitestOutput: any = {
        testResults: [
          {
            name: 'Test Suite (with) [special] chars',
            filepath: '/path/to/my-test-file.ts',
            result: { state: 'pass' },
            tests: [],
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(vitestOutput));

      expect(results[0].testCase).toMatch(/^.*my-test-file-test-suite-with-special-chars$/);
      expect(results[0].testCase).not.toContain('(');
      expect(results[0].testCase).not.toContain(')');
      expect(results[0].testCase).not.toContain('[');
      expect(results[0].testCase).not.toContain(']');
    });

    it('should mark tests as failed if they exceed max duration', async () => {
      adapter = new VitestAdapter({ maxDuration: 1000 });

      const vitestOutput: any = {
        testResults: [
          {
            name: 'Test Suite',
            filepath: '/path/to/test.ts',
            result: { state: 'pass' },
            tests: [
              {
                name: 'slow test',
                filepath: '/path/to/test.ts',
                result: { state: 'pass', duration: 5000 },
              },
            ],
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(vitestOutput));

      const slowTest = results.find(r => r.testCase.includes('slow-test'));
      expect(slowTest?.outcome).toBe('failed');
    });

    it('should load from file path', async () => {
      const vitestOutput: any = {
        testResults: [
          {
            name: 'Test Suite',
            filepath: '/path/to/test.ts',
            result: { state: 'pass' },
            tests: [],
          },
        ],
      };

      writeFileSync(testFilePath, JSON.stringify(vitestOutput));
      const results = await adapter.load(testFilePath);

      expect(results).toHaveLength(1);
      expect(results[0].outcome).toBe('passed');
    });
  });

  describe('edge cases', () => {
    it('should handle empty test results', async () => {
      const vitestOutput: any = {
        testResults: [],
      };

      const results = await adapter.load(JSON.stringify(vitestOutput));
      expect(results).toHaveLength(0);
    });

    it('should handle malformed JSON gracefully', async () => {
      await expect(adapter.load('invalid json')).rejects.toThrow();
    });
  });
});
