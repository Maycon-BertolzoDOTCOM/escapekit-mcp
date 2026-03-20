import { describe, it, expect, beforeEach } from 'vitest';
import { JestAdapter } from '../../src/adapters/jest-adapter';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

describe('JestAdapter', () => {
  let adapter: JestAdapter;
  const testFilePath = join(process.cwd(), 'test-jest-output.json');

  beforeEach(() => {
    adapter = new JestAdapter();
    if (existsSync(testFilePath)) unlinkSync(testFilePath);
  });

  describe('canHandle', () => {
    it('should identify Jest JSON correctly', () => {
      const jestJson = JSON.stringify({
        numTotalTests: 2,
        testResults: [{ name: 'suite', tests: [] }],
      });
      expect(adapter.canHandle(jestJson)).toBe(true);
    });

    it('should reject non-Jest JSON', () => {
      const otherJson = JSON.stringify({ random: 'data' });
      expect(adapter.canHandle(otherJson)).toBe(false);
    });

    it('should reject invalid JSON', () => {
      expect(adapter.canHandle('not json')).toBe(false);
    });
  });

  describe('getFrameworkName', () => {
    it('should return jest', () => {
      expect(adapter.getFrameworkName()).toBe('jest');
    });
  });

  describe('load', () => {
    it('should parse Jest JSON with passed tests', async () => {
      const data = {
        numTotalTests: 2,
        testResults: [
          {
            name: 'Suite',
            tests: [
              { title: 'should pass', status: 'passed' },
              { title: 'also passes', status: 'passed' },
            ],
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(data));
      expect(results).toHaveLength(2);
      expect(results.every(r => r.outcome === 'passed')).toBe(true);
    });

    it('should parse Jest JSON with failed tests', async () => {
      const data = {
        numTotalTests: 1,
        testResults: [
          {
            name: 'Suite',
            tests: [
              {
                title: 'should fail',
                status: 'failed',
                message: 'Expected true to be false',
              },
            ],
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(data));
      expect(results).toHaveLength(1);
      expect(results[0].outcome).toBe('failed');
      expect(results[0].error).toContain('Expected true to be false');
    });

    it('should parse Jest JSON with skipped tests', async () => {
      const data = {
        numTotalTests: 1,
        testResults: [
          {
            name: 'Suite',
            tests: [{ title: 'pending test', status: 'pending' }],
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(data));
      expect(results[0].outcome).toBe('skipped');
    });

    it('should filter skipped when configured', async () => {
      adapter = new JestAdapter({ includeSkipped: false });
      const data = {
        numTotalTests: 2,
        testResults: [
          {
            name: 'Suite',
            tests: [
              { title: 'passes', status: 'passed' },
              { title: 'skipped', status: 'skipped' },
            ],
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(data));
      expect(results).toHaveLength(1);
      expect(results[0].outcome).toBe('passed');
    });

    it('should normalize test case names', async () => {
      const data = {
        numTotalTests: 1,
        testResults: [
          {
            name: 'My Suite',
            tests: [{ title: 'should work (correctly) [fast]', status: 'passed' }],
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(data));
      expect(results[0].testCase).toMatch(/^my-suite-should-work-correctly-fast$/);
    });

    it('should load from file', async () => {
      const data = {
        numTotalTests: 1,
        testResults: [
          {
            name: 'Suite',
            tests: [{ title: 'passes', status: 'passed' }],
          },
        ],
      };

      writeFileSync(testFilePath, JSON.stringify(data));
      const results = await adapter.load(testFilePath);
      expect(results).toHaveLength(1);
      expect(results[0].outcome).toBe('passed');
    });

    it('should handle empty test results', async () => {
      const data = { numTotalTests: 0, testResults: [] };
      const results = await adapter.load(JSON.stringify(data));
      expect(results).toHaveLength(0);
    });

    it('should handle nested suites', async () => {
      const data = {
        numTotalTests: 2,
        testResults: [
          {
            name: 'Parent',
            tests: [{ title: 'parent test', status: 'passed' }],
            suites: [
              {
                name: 'Child',
                tests: [{ title: 'child test', status: 'passed' }],
              },
            ],
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(data));
      expect(results).toHaveLength(2);
    });
  });
});
