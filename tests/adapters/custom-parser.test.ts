import { describe, it, expect } from 'vitest';
import { CustomTestParser, createCustomTestResult, exampleTransform } from '../../src/adapters/custom-parser';
import { CustomTestCase } from '../../src/adapters/custom-parser';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

describe('CustomTestParser', () => {
  let parser: CustomTestParser;
  const testFilePath = join(process.cwd(), 'test-custom-results.json');

  beforeEach(() => {
    parser = new CustomTestParser();
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
    it('should identify custom JSON files correctly', () => {
      const customJson = JSON.stringify({
        version: '1.0',
        framework: 'custom',
        tests: [{ name: 'test1', status: 'passed' }],
      });
      expect(parser.canHandle(customJson)).toBe(true);
    });

    it('should reject invalid JSON', () => {
      expect(parser.canHandle('invalid json')).toBe(false);
    });

    it('should accept any JSON as the parser is now more permissive', () => {
      const invalidJson = JSON.stringify({ version: '1.0' });
      expect(parser.canHandle(invalidJson)).toBe(true);
    });
  });

  describe('getFrameworkName', () => {
    it('should return correct framework name', () => {
      expect(parser.getFrameworkName()).toBe('custom');
    });

    it('should return custom framework name if schema provided', () => {
      parser = new CustomTestParser({
        schema: {
          version: '1.0',
          framework: 'my-framework',
          tests: [],
        },
      });
      expect(parser.getFrameworkName()).toBe('my-framework');
    });
  });

  describe('load', () => {
    it('should parse custom JSON with passed tests', async () => {
      const customJson = JSON.stringify({
        version: '1.0',
        framework: 'custom',
        tests: [
          { name: 'test 1', status: 'passed', duration: 100 },
          { name: 'test 2', status: 'passed', duration: 200 },
        ],
      });

      const results = await parser.load(customJson);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.outcome === 'passed')).toBe(true);
      expect(results[0].duration).toBe(100);
      expect(results[1].duration).toBe(200);
    });

    it('should parse custom JSON with failed tests', async () => {
      const customJson = JSON.stringify({
        version: '1.0',
        framework: 'custom',
        tests: [
          {
            name: 'failing test',
            status: 'failed',
            duration: 50,
            error: 'Assertion failed',
            stackTrace: 'at test.js:10',
          },
        ],
      });

      const results = await parser.load(customJson);

      expect(results).toHaveLength(1);
      expect(results[0].outcome).toBe('failed');
      expect(results[0].error).toContain('Assertion failed');
      expect(results[0].error).toContain('test.js:10');
    });

    it('should parse custom JSON with skipped tests', async () => {
      const customJson = JSON.stringify({
        version: '1.0',
        framework: 'custom',
        tests: [
          { name: 'skipped test', status: 'skipped', duration: 0 },
        ],
      });

      const results = await parser.load(customJson);

      expect(results).toHaveLength(1);
      expect(results[0].outcome).toBe('skipped');
      expect(results[0].metadata?.isSkipped).toBe(true);
    });

    it('should filter out skipped tests when configured', async () => {
      parser = new CustomTestParser({ includeSkipped: false });

      const customJson = JSON.stringify({
        version: '1.0',
        framework: 'custom',
        tests: [
          { name: 'test 1', status: 'passed', duration: 100 },
          { name: 'skipped test', status: 'skipped', duration: 0 },
        ],
      });

      const results = await parser.load(customJson);

      const skippedTest = results.find(r => r.outcome === 'skipped');
      expect(skippedTest).toBeUndefined();
      expect(results).toHaveLength(1);
    });

    it('should normalize test case names correctly', async () => {
      const customJson = JSON.stringify({
        version: '1.0',
        framework: 'custom',
        tests: [
          { name: 'should handle (special) [chars]', status: 'passed' },
        ],
      });

      const results = await parser.load(customJson);

      expect(results[0].testCase).toMatch(/^custom-should-handle-special-chars$/);
      expect(results[0].testCase).not.toContain('(');
      expect(results[0].testCase).not.toContain(')');
      expect(results[0].testCase).not.toContain('[');
      expect(results[0].testCase).not.toContain(']');
    });

    it('should support custom transform function', async () => {
      parser = new CustomTestParser({
        transform: (test: CustomTestCase, suite?: string) => {
          return {
            testCase: `custom-${test.name}`,
            outcome: test.status === 'passed' ? 'passed' : 'failed',
            duration: test.duration || 0,
            metadata: {
              framework: suite || 'custom',
              customProperty: 'custom-value',
            },
          };
        },
      });

      const customJson = JSON.stringify({
        version: '1.0',
        framework: 'my-framework',
        tests: [
          { name: 'test 1', status: 'passed', duration: 100 },
        ],
      });

      const results = await parser.load(customJson);

      expect(results[0].testCase).toBe('custom-test 1');
      expect(results[0].metadata?.customProperty).toBe('custom-value');
    });

    it('should load from file path', async () => {
      const customJson = JSON.stringify({
        version: '1.0',
        framework: 'custom',
        tests: [
          { name: 'test 1', status: 'passed', duration: 100 },
        ],
      });

      writeFileSync(testFilePath, customJson);
      const results = await parser.load(testFilePath);

      expect(results).toHaveLength(1);
      expect(results[0].outcome).toBe('passed');
    });
  });

  describe('status mapping', () => {
    it('should map various status values correctly', async () => {
      const customJson = JSON.stringify({
        version: '1.0',
        framework: 'custom',
        tests: [
          { name: 'passed', status: 'passed' },
          { name: 'success', status: 'success' },
          { name: 'ok', status: 'ok' },
          { name: 'failed', status: 'failed' },
          { name: 'error', status: 'error' },
          { name: 'fail', status: 'fail' },
          { name: 'skipped', status: 'skipped' },
          { name: 'pending', status: 'pending' },
          { name: 'todo', status: 'todo' },
        ],
      });

      const results = await parser.load(customJson);

      expect(results.filter(r => r.outcome === 'passed')).toHaveLength(3);
      expect(results.filter(r => r.outcome === 'failed')).toHaveLength(3);
      expect(results.filter(r => r.outcome === 'skipped')).toHaveLength(3);
    });
  });

  describe('edge cases', () => {
    it('should handle empty test results', async () => {
      const customJson = JSON.stringify({
        version: '1.0',
        framework: 'custom',
        tests: [],
      });

      const results = await parser.load(customJson);
      expect(results).toHaveLength(0);
    });

    it('should handle malformed JSON gracefully', async () => {
      await expect(parser.load('invalid json')).rejects.toThrow();
    });

    it('should mark tests as failed if they exceed max duration', async () => {
      parser = new CustomTestParser({ maxDuration: 50 });

      const customJson = JSON.stringify({
        version: '1.0',
        framework: 'custom',
        tests: [
          { name: 'slow test', status: 'passed', duration: 100 },
        ],
      });

      const results = await parser.load(customJson);

      expect(results[0].outcome).toBe('failed');
    });
  });
});

describe('Helper Functions', () => {
  describe('createCustomTestResult', () => {
    it('should create a valid custom test result object', () => {
      const tests: CustomTestCase[] = [
        { name: 'test 1', status: 'passed', duration: 100 },
      ];

      const result = createCustomTestResult('my-framework', tests, {
        runId: '12345',
      });

      expect(result.version).toBe('1.0');
      expect(result.framework).toBe('my-framework');
      expect(result.tests).toEqual(tests);
      expect(result.metadata?.runId).toBe('12345');
    });
  });

  describe('exampleTransform', () => {
    it('should transform a custom test case to test result', () => {
      const test: CustomTestCase = {
        name: 'my test',
        status: 'passed',
        duration: 100,
        id: 'test-1',
        timestamp: '2026-03-16T00:00:00Z',
      };

      const result = exampleTransform(test, 'my-suite');

      expect(result.testCase).toBe('my-suite-my-test');
      expect(result.outcome).toBe('passed');
      expect(result.duration).toBe(100);
      expect(result.metadata?.framework).toBe('my-suite');
      expect(result.metadata?.customId).toBe('test-1');
      expect(result.metadata?.timestamp).toBe('2026-03-16T00:00:00Z');
    });

    it('should transform a failed test case', () => {
      const test: CustomTestCase = {
        name: 'failing test',
        status: 'failed',
        duration: 50,
      };

      const result = exampleTransform(test, 'test-suite');

      expect(result.testCase).toBe('test-suite-failing-test');
      expect(result.outcome).toBe('failed');
    });
  });
});