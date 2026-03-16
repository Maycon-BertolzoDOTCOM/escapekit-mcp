import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadTestResults, loadMultipleTestResults } from '../../scripts/load-test-results';
import { detectFramework } from '../../scripts/load-test-results';
import { TestResult } from '../../src/adapters/index';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

describe('loadTestResults', () => {
  const vitestJsonPath = join(process.cwd(), 'test-vitest-results.json');
  const mochaXmlPath = join(process.cwd(), 'test-mocha-results.xml');
  const customJsonPath = join(process.cwd(), 'test-custom-results.json');

  beforeEach(() => {
    // Create test files
    writeFileSync(vitestJsonPath, JSON.stringify({
      testResults: [
        {
          name: 'test.js',
          filepath: 'test.js',
          result: {
            state: 'pass',
            duration: 100,
          },
          tests: [],
        },
      ],
    }));

    writeFileSync(mochaXmlPath, `<?xml version="1.0"?>
<testsuites>
  <testsuite name="Test Suite" tests="1" failures="0" errors="0" skipped="0">
    <testcase name="should pass" classname="Test Suite" time="0.010"/>
  </testsuite>
</testsuites>`);

    writeFileSync(customJsonPath, JSON.stringify({
      version: '1.0',
      framework: 'custom',
      tests: [
        { name: 'test 1', status: 'passed', duration: 100 },
      ],
    }));
  });

  afterEach(() => {
    [vitestJsonPath, mochaXmlPath, customJsonPath].forEach(path => {
      if (existsSync(path)) {
        unlinkSync(path);
      }
    });
  });

  describe('loadTestResults', () => {
    it('should load Vitest JSON results', async () => {
      const vitestJson = JSON.stringify({
        testResults: [
          {
            name: 'test.js',
            filepath: 'test.js',
            result: {
              state: 'pass',
              duration: 100,
            },
            tests: [],
          },
        ],
      });

      const results = await loadTestResults({ source: vitestJson, framework: 'vitest' });

      expect(results).toHaveLength(1);
      expect(results[0].outcome).toBe('passed');
      expect(results[0].duration).toBe(100);
    });

    it('should load Mocha XML results', async () => {
      const mochaXml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="Test Suite" tests="1" failures="0" errors="0" skipped="0">
    <testcase name="should pass" classname="Test Suite" time="0.010"/>
  </testsuite>
</testsuites>`;

      const results = await loadTestResults({ source: mochaXml, framework: 'mocha' });

      expect(results).toHaveLength(1);
      expect(results[0].outcome).toBe('passed');
    });

    it('should load custom JSON results', async () => {
      const customJson = JSON.stringify({
        version: '1.0',
        framework: 'custom',
        tests: [
          { name: 'test 1', status: 'passed', duration: 100 },
        ],
      });

      const results = await loadTestResults({ source: customJson, framework: 'custom' });

      expect(results).toHaveLength(1);
      expect(results[0].outcome).toBe('passed');
    });

    it('should auto-detect Vitest framework', async () => {
      const vitestJson = JSON.stringify({
        testResults: [
          {
            name: 'test.js',
            filepath: 'test.js',
            result: {
              state: 'pass',
              duration: 100,
            },
            tests: [],
          },
        ],
      });

      const results = await loadTestResults({ source: vitestJson });

      expect(results).toHaveLength(1);
      expect(results[0].outcome).toBe('passed');
    });

    it('should auto-detect Mocha framework', async () => {
      const mochaXml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="Test Suite" tests="1" failures="0" errors="0" skipped="0">
    <testcase name="should pass" classname="Test Suite" time="0.010"/>
  </testsuite>
</testsuites>`;

      const results = await loadTestResults({ source: mochaXml });

      expect(results).toHaveLength(1);
      expect(results[0].outcome).toBe('passed');
    });

    it('should load from file path', async () => {
      const results = await loadTestResults({ source: vitestJsonPath });

      expect(results).toHaveLength(1);
      expect(results[0].outcome).toBe('passed');
    });

    it('should throw error for unsupported framework', async () => {
      await expect(
        loadTestResults({ source: 'invalid', framework: 'unknown' as any })
      ).rejects.toThrow('Unsupported framework');
    });
  });

  describe('loadMultipleTestResults', () => {
    it('should load multiple test result files', async () => {
      const results = await loadMultipleTestResults([
        vitestJsonPath,
        customJsonPath,
      ]);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.outcome === 'passed')).toBe(true);
    });

    it('should aggregate results from multiple sources', async () => {
      writeFileSync(vitestJsonPath, JSON.stringify({
        testResults: [
          {
            name: 'test.js',
            filepath: 'test.js',
            result: {
              state: 'pass',
              duration: 100,
            },
            tests: [],
          },
          {
            name: 'test2.js',
            filepath: 'test2.js',
            result: {
              state: 'fail',
              duration: 50,
            },
            tests: [],
          },
        ],
      }));

      const results = await loadMultipleTestResults([vitestJsonPath, customJsonPath]);

      expect(results).toHaveLength(3);
      expect(results.filter(r => r.outcome === 'passed')).toHaveLength(2);
      expect(results.filter(r => r.outcome === 'failed')).toHaveLength(1);
    });

    it('should throw error if any source fails', async () => {
      await expect(
        loadMultipleTestResults([
          vitestJsonPath,
          'non-existent-file.json',
        ])
      ).rejects.toThrow();
    });
  });

  describe('detectFramework', () => {
    it('should detect Vitest from testResults field', () => {
      const framework = detectFramework(JSON.stringify({
        testResults: [],
      }));
      expect(framework).toBe('vitest');
    });

    it('should detect Mocha from testsuite tag', () => {
      const framework = detectFramework(
        '<?xml version="1.0"?><testsuite></testsuite>'
      );
      expect(framework).toBe('mocha');
    });

    it('should detect custom format from tests array', () => {
      const framework = detectFramework(JSON.stringify({
        tests: [],
        framework: 'custom',
      }));
      expect(framework).toBe('custom');
    });

    it('should default to custom for unknown formats', () => {
      const framework = detectFramework('some string');
      expect(framework).toBe('custom');
    });
  });
});
