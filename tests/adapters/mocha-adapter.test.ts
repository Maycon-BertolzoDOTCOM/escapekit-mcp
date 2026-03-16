import { describe, it, expect, vi } from 'vitest';
import { MochaAdapter } from '../../src/adapters/mocha-adapter';
import { TestResult } from '../../src/adapters/index';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

describe('MochaAdapter', () => {
  let adapter: MochaAdapter;
  const testFilePath = join(process.cwd(), 'test-mocha-output.xml');

  beforeEach(() => {
    adapter = new MochaAdapter();
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
    it('should identify Mocha XML files correctly', () => {
      const mochaXml = '<?xml version="1.0"?><testsuites><testsuite name="Suite"></testsuite></testsuites>';
      writeFileSync(testFilePath, mochaXml);
      expect(adapter.canHandle(testFilePath)).toBe(true);
    });

    it('should reject non-Mocha XML files', () => {
      const nonMochaXml = '<?xml version="1.0"?><other></other>';
      writeFileSync(testFilePath, nonMochaXml);
      expect(adapter.canHandle(testFilePath)).toBe(false);
    });

    it('should reject non-XML files', () => {
      expect(adapter.canHandle('test.txt')).toBe(false);
    });

    it('should identify XML content directly', () => {
      const mochaXml = '<?xml version="1.0"?><testsuite name="Suite"></testsuite>';
      expect(adapter.canHandle(mochaXml)).toBe(true);
    });
  });

  describe('getFrameworkName', () => {
    it('should return correct framework name', () => {
      expect(adapter.getFrameworkName()).toBe('mocha');
    });
  });

  describe('load', () => {
    it('should parse Mocha XML output with passed tests', async () => {
      const mochaXml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="Test Suite" tests="2" failures="0" errors="0" skipped="0" time="0.057">
    <testcase name="should pass" classname="Test Suite" time="0.042"/>
    <testcase name="should also pass" classname="Test Suite" time="0.015"/>
  </testsuite>
</testsuites>`;

      const results = await adapter.load(mochaXml);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.outcome === 'passed')).toBe(true);
      expect(results[0].duration).toBe(42);
      expect(results[1].duration).toBe(15);
    });

    it('should parse Mocha XML output with failed tests', async () => {
      const mochaXml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="Test Suite" tests="2" failures="1" errors="0" skipped="0">
    <testcase name="should pass" classname="Test Suite" time="0.010"/>
    <testcase name="should fail" classname="Test Suite" time="0.005">
      <failure message="Test failed" type="AssertionError">
        AssertionError: Test failed
        at test.js:10
      </failure>
    </testcase>
  </testsuite>
</testsuites>`;

      const results = await adapter.load(mochaXml);

      const failedTest = results.find(r => r.outcome === 'failed');
      expect(failedTest).toBeDefined();
      expect(failedTest?.testCase).toContain('should-fail');
      expect(failedTest?.error).toContain('Test failed');
      expect(failedTest?.error).toContain('test.js:10');
    });

    it('should parse Mocha XML output with skipped tests', async () => {
      const mochaXml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="Test Suite" tests="1" failures="0" errors="0" skipped="1">
    <testcase name="should skip" classname="Test Suite" time="0">
      <skipped/>
    </testcase>
  </testsuite>
</testsuites>`;

      const results = await adapter.load(mochaXml);

      expect(results).toHaveLength(1);
      const skippedTest = results.find(r => r.outcome === 'skipped');
      expect(skippedTest).toBeDefined();
      expect(skippedTest?.metadata?.isSkipped).toBe(true);
    });

    it('should filter out skipped tests when configured', async () => {
      adapter = new MochaAdapter({ includeSkipped: false });

      const mochaXml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="Test Suite" tests="2" failures="0" errors="0" skipped="1">
    <testcase name="should pass" classname="Test Suite" time="0.010"/>
    <testcase name="should skip" classname="Test Suite" time="0">
      <skipped/>
    </testcase>
  </testsuite>
</testsuites>`;

      const results = await adapter.load(mochaXml);

      const skippedTest = results.find(r => r.outcome === 'skipped');
      expect(skippedTest).toBeUndefined();
      expect(results).toHaveLength(1);
    });

    it('should normalize test case names correctly', async () => {
      const mochaXml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="My Test Suite" tests="1" failures="0" errors="0" skipped="0">
    <testcase name="should handle (special) [chars]" classname="My Test Suite" time="0.010"/>
  </testsuite>
</testsuites>`;

      const results = await adapter.load(mochaXml);

      expect(results[0].testCase).toMatch(/^my-test-suite-should-handle-special-chars$/);
      expect(results[0].testCase).not.toContain('(');
      expect(results[0].testCase).not.toContain(')');
      expect(results[0].testCase).not.toContain('[');
      expect(results[0].testCase).not.toContain(']');
    });

    it('should handle test errors', async () => {
      const mochaXml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="Test Suite" tests="1" failures="0" errors="1" skipped="0">
    <testcase name="should error" classname="Test Suite" time="0.005">
      <error message="Error occurred" type="Error">
        Error: Error occurred
        at test.js:15
      </error>
    </testcase>
  </testsuite>
</testsuites>`;

      const results = await adapter.load(mochaXml);

      const errorTest = results.find(r => r.outcome === 'failed');
      expect(errorTest).toBeDefined();
      expect(errorTest?.error).toContain('Error occurred');
    });

    it('should load from file path', async () => {
      const mochaXml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="Test Suite" tests="1" failures="0" errors="0" skipped="0">
    <testcase name="should pass" classname="Test Suite" time="0.010"/>
  </testsuite>
</testsuites>`;

      writeFileSync(testFilePath, mochaXml);
      const results = await adapter.load(testFilePath);

      expect(results).toHaveLength(1);
      expect(results[0].outcome).toBe('passed');
    });
  });

  describe('edge cases', () => {
    it('should handle empty test results', async () => {
      const mochaXml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="Test Suite" tests="0" failures="0" errors="0" skipped="0"/>
</testsuites>`;

      const results = await adapter.load(mochaXml);
      expect(results).toHaveLength(0);
    });

    it('should handle malformed XML gracefully', async () => {
      // Malformed XML without proper tags should return empty array
      const results = await adapter.load('invalid xml');
      expect(results).toEqual([]);
    });

    it('should handle single testsuite without testsuites wrapper', async () => {
      const mochaXml = `<?xml version="1.0"?>
<testsuite name="Test Suite" tests="1" failures="0" errors="0" skipped="0">
  <testcase name="should pass" classname="Test Suite" time="0.010"/>
</testsuite>`;

      const results = await adapter.load(mochaXml);

      expect(results).toHaveLength(1);
      expect(results[0].outcome).toBe('passed');
    });
  });
});
