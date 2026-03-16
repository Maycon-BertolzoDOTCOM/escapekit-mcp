import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadTestResults, loadMultipleTestResults, detectFramework } from '../../scripts/load-test-results';
import { VitestAdapter } from '../../src/adapters/vitest-adapter';
import { MochaAdapter } from '../../src/adapters/mocha-adapter';
import { CustomTestParser } from '../../src/adapters/custom-parser';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

describe('Kiwi TCMS Integration - End-to-End Tests', () => {
  const testDir = join(process.cwd(), 'tests', 'fixtures', 'integration');
  const vitestResultsPath = join(testDir, 'vitest-results.json');
  const mochaResultsPath = join(testDir, 'mocha-results.xml');
  const customResultsPath = join(testDir, 'custom-results.json');

  beforeAll(() => {
    // Ensure test directory exists (already created)
    // Test fixtures will be created directly

    // Create Vitest test results
    writeFileSync(vitestResultsPath, JSON.stringify({
      testResults: [
        {
          name: 'test-basic.test.ts',
          filepath: 'tests/test-basic.test.ts',
          tests: [
            {
              name: 'should add two numbers',
              result: {
                state: 'pass',
                duration: 25,
              },
            },
            {
              name: 'should subtract two numbers',
              result: {
                state: 'pass',
                duration: 25,
              },
            },
          ],
        },
        {
          name: 'test-advanced.test.ts',
          filepath: 'tests/test-advanced.test.ts',
          tests: [
            {
              name: 'should multiply two numbers',
              result: {
                state: 'pass',
                duration: 30,
              },
            },
            {
              name: 'should divide two numbers',
              result: {
                state: 'fail',
                duration: 70,
                error: {
                  message: 'Expected 5 to be 6',
                },
              },
            },
          ],
        },
      ],
    }));

    // Create Mocha test results
    writeFileSync(mochaResultsPath, `<?xml version="1.0"?>
<testsuites name="Mocha Tests" tests="4" failures="1" errors="0" skipped="0">
  <testsuite name="test-basic.js" tests="2" failures="0" errors="0" skipped="0" time="0.050">
    <testcase name="should add two numbers" classname="test-basic.js" time="0.025"/>
    <testcase name="should subtract two numbers" classname="test-basic.js" time="0.025"/>
  </testsuite>
  <testsuite name="test-advanced.js" tests="2" failures="1" errors="0" skipped="0" time="0.100">
    <testcase name="should multiply two numbers" classname="test-advanced.js" time="0.030"/>
    <testcase name="should divide two numbers" classname="test-advanced.js" time="0.070">
      <failure message="Expected 5 to be 6" type="AssertionError">
        Error: Expected 5 to be 6
    at test (test-advanced.js:10:5)
      </failure>
    </testcase>
  </testsuite>
</testsuites>`);

    // Create custom test results
    writeFileSync(customResultsPath, JSON.stringify({
      version: '1.0',
      framework: 'custom',
      tests: [
        {
          name: 'should add two numbers',
          status: 'passed',
          duration: 25,
          file: 'test-basic.js',
        },
        {
          name: 'should subtract two numbers',
          status: 'passed',
          duration: 25,
          file: 'test-basic.js',
        },
        {
          name: 'should multiply two numbers',
          status: 'passed',
          duration: 30,
          file: 'test-advanced.js',
        },
        {
          name: 'should divide two numbers',
          status: 'failed',
          duration: 70,
          file: 'test-advanced.js',
          message: 'Expected 5 to be 6',
        },
      ],
    }));
  });

  afterAll(() => {
    // Clean up test files
    [vitestResultsPath, mochaResultsPath, customResultsPath].forEach(path => {
      if (existsSync(path)) {
        unlinkSync(path);
      }
    });
  });

  describe('Vitest End-to-End', () => {
    it('should load Vitest results and parse correctly', async () => {
      const adapter = new VitestAdapter();
      const results = await adapter.load(vitestResultsPath);

      expect(results).toHaveLength(4);
      expect(results.filter(r => r.outcome === 'passed')).toHaveLength(3);
      expect(results.filter(r => r.outcome === 'failed')).toHaveLength(1);
    });

    it('should auto-detect Vitest framework from file', async () => {
      const framework = detectFramework(vitestResultsPath);
      expect(framework).toBe('vitest');
    });

    it('should load Vitest results via loadTestResults', async () => {
      const results = await loadTestResults({ source: vitestResultsPath });

      expect(results).toHaveLength(4);
      // Vitest test case format: {filepath}-{testname} (kebab-case)
      expect(results[0].testCase).toMatch(/should-add-two-numbers$/);
    });

    it('should preserve test metadata from Vitest', async () => {
      const results = await loadTestResults({ source: vitestResultsPath });
      const failedTest = results.find(r => r.outcome === 'failed');

      expect(failedTest).toBeDefined();
      expect(failedTest?.duration).toBeGreaterThan(0);
    });
  });

  describe('Mocha End-to-End', () => {
    it('should load Mocha results and parse correctly', async () => {
      const adapter = new MochaAdapter();
      const results = await adapter.load(mochaResultsPath);

      expect(results).toHaveLength(4);
      expect(results.filter(r => r.outcome === 'passed')).toHaveLength(3);
      expect(results.filter(r => r.outcome === 'failed')).toHaveLength(1);
    });

    it('should auto-detect Mocha framework from file', async () => {
      const framework = detectFramework(mochaResultsPath);
      expect(framework).toBe('mocha');
    });

    it('should load Mocha results via loadTestResults', async () => {
      const results = await loadTestResults({ source: mochaResultsPath });

      expect(results).toHaveLength(4);
      // Mocha test case format: {classname}-{testname}
      expect(results[0].testCase).toMatch(/should-add-two-numbers$/);
    });

    it('should extract error information from Mocha XML', async () => {
      const results = await loadTestResults({ source: mochaResultsPath });
      const failedTest = results.find(r => r.outcome === 'failed');

      expect(failedTest).toBeDefined();
      expect(failedTest?.outcome).toBe('failed');
    });
  });

  describe('Custom Parser End-to-End', () => {
    it('should load custom results and parse correctly', async () => {
      const parser = new CustomTestParser();
      const results = await parser.load(customResultsPath);

      expect(results).toHaveLength(4);
      expect(results.filter(r => r.outcome === 'passed')).toHaveLength(3);
      expect(results.filter(r => r.outcome === 'failed')).toHaveLength(1);
    });

    it('should auto-detect custom framework from file', async () => {
      const framework = detectFramework(customResultsPath);
      expect(framework).toBe('custom');
    });

    it('should load custom results via loadTestResults', async () => {
      const results = await loadTestResults({ source: customResultsPath });

      expect(results).toHaveLength(4);
      expect(results[0].testCase).toMatch(/should-add-two-numbers$/);
    });

    it('should preserve custom metadata', async () => {
      const results = await loadTestResults({ source: customResultsPath });
      const failedTest = results.find(r => r.outcome === 'failed');

      expect(failedTest).toBeDefined();
      expect(failedTest?.duration).toBe(70);
    });
  });

  describe('Multi-Source Integration', () => {
    it('should load results from multiple sources', async () => {
      const results = await loadMultipleTestResults([
        vitestResultsPath,
        mochaResultsPath,
        customResultsPath,
      ]);

      expect(results).toHaveLength(12);
    });

    it('should aggregate results correctly across frameworks', async () => {
      const results = await loadMultipleTestResults([
        vitestResultsPath,
        mochaResultsPath,
        customResultsPath,
      ]);

      const passed = results.filter(r => r.outcome === 'passed').length;
      const failed = results.filter(r => r.outcome === 'failed').length;

      expect(passed).toBe(9);
      expect(failed).toBe(3);
    });

    it('should handle mixed frameworks in single load', async () => {
      const vitestResults = await loadTestResults({ source: vitestResultsPath });
      const mochaResults = await loadTestResults({ source: mochaResultsPath });
      const customResults = await loadTestResults({ source: customResultsPath });

      const allResults = [...vitestResults, ...mochaResults, ...customResults];

      expect(allResults).toHaveLength(12);
      expect(allResults.every(r => typeof r.duration === 'number')).toBe(true);
      expect(allResults.every(r => typeof r.testCase === 'string')).toBe(true);
    });
  });

  describe('Real-world Scenario Tests', () => {
    it('should simulate large test suite import', async () => {
      // Create a large test result file simulating 100 tests
      const largeTestResults = {
        testResults: Array.from({ length: 100 }, (_, i) => ({
          name: `test-${i}.test.ts`,
          filepath: `tests/test-${i}.test.ts`,
          result: {
            state: i % 5 === 0 ? 'fail' : 'pass',
            duration: Math.floor(Math.random() * 100),
          },
          tests: [],
        })),
      };

      const largeTestPath = join(testDir, 'large-test-results.json');
      writeFileSync(largeTestPath, JSON.stringify(largeTestResults));

      const results = await loadTestResults({ source: largeTestPath });

      expect(results).toHaveLength(100);
      expect(results.filter(r => r.outcome === 'passed')).toHaveLength(80);
      expect(results.filter(r => r.outcome === 'failed')).toHaveLength(20);

      // Clean up
      if (existsSync(largeTestPath)) {
        unlinkSync(largeTestPath);
      }
    });

    it('should handle concurrent loads efficiently', async () => {
      const startTime = Date.now();

      const results = await loadMultipleTestResults([
        vitestResultsPath,
        mochaResultsPath,
        customResultsPath,
      ]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(12);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });

  describe('Error Handling', () => {
    it('should handle missing files gracefully', async () => {
      await expect(
        loadTestResults({ source: '/nonexistent/path/to/file.json' })
      ).rejects.toThrow();
    });

    it('should handle invalid JSON in custom format', async () => {
      const invalidPath = join(testDir, 'invalid-results.json');
      writeFileSync(invalidPath, '{ invalid json }');

      // Should throw error for invalid JSON
      await expect(
        loadTestResults({ source: invalidPath, framework: 'custom' })
      ).rejects.toThrow();

      if (existsSync(invalidPath)) {
        unlinkSync(invalidPath);
      }
    });
  });
});