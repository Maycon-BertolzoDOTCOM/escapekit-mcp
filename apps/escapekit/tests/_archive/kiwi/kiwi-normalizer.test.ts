import { describe, it, expect } from 'vitest';
import {
  normalizeVitest,
  normalizeMocha,
  normalizeGeneric,
  normalizeTestName,
  parsePriority,
  parseStatus,
  analyzeTestFile,
  PRIORITY_MAP,
  STATUS_MAP,
} from '../../scripts/kiwi-normalizer';

describe('kiwi-normalizer', () => {
  describe('normalizeVitest', () => {
    it('should normalize test name', () => {
      expect(normalizeVitest('should work correctly')).toBe('should-work-correctly');
    });

    it('should remove special characters', () => {
      expect(normalizeVitest('test (with) [brackets]')).toBe('test-with-brackets');
    });

    it('should add filepath prefix', () => {
      expect(normalizeVitest('test name', 'src/components/Button.test.ts'))
        .toContain('button-test-name');
    });
  });

  describe('normalizeMocha', () => {
    it('should normalize with classname prefix', () => {
      expect(normalizeMocha('should work', 'MyClass'))
        .toBe('myclass-should-work');
    });

    it('should handle empty classname', () => {
      expect(normalizeMocha('should work', ''))
        .toBe('should-work');
    });
  });

  describe('normalizeGeneric', () => {
    it('should normalize and lowercase', () => {
      expect(normalizeGeneric('TEST NAME')).toBe('test-name');
    });

    it('should trim and remove extra spaces', () => {
      expect(normalizeGeneric('  test   name  ')).toBe('test-name');
    });
  });

  describe('normalizeTestName', () => {
    it('should trim and collapse spaces', () => {
      expect(normalizeTestName('  test   name  ')).toBe('test name');
    });
  });

  describe('parsePriority', () => {
    it('should parse P1 from test name', () => {
      expect(parsePriority('test [P1]')).toBe(1);
    });

    it('should parse P3 from test name', () => {
      expect(parsePriority('test [P3]')).toBe(3);
    });

    it('should parse critical from metadata', () => {
      expect(parsePriority('test', { priority: 'critical' })).toBe(1);
    });

    it('should default to P1', () => {
      expect(parsePriority('test')).toBe(1);
    });
  });

  describe('parseStatus', () => {
    it('should map passed to PASSED', () => {
      expect(parseStatus('passed')).toBe(2);
    });

    it('should map failed to FAILED', () => {
      expect(parseStatus('failed')).toBe(3);
    });

    it('should map skipped to IDLE', () => {
      expect(parseStatus('skipped')).toBe(1);
    });
  });

  describe('analyzeTestFile', () => {
    it('should detect vitest format', () => {
      const content = JSON.stringify({
        numTotalTestSuites: 10,
        testResults: [],
      });
      expect(analyzeTestFile(content).framework).toBe('vitest');
    });

    it('should detect jest format', () => {
      const content = JSON.stringify({
        numTotalTests: 100,
        testResults: [],
        snapshot: {},
      });
      expect(analyzeTestFile(content).framework).toBe('jest');
    });

    it('should detect mocha format', () => {
      const content = JSON.stringify({
        stats: { suites: 5 },
        failures: [],
      });
      expect(analyzeTestFile(content).framework).toBe('mocha');
    });
  });

  describe('PRIORITY_MAP', () => {
    it('should have P1-P5 mapped', () => {
      expect(PRIORITY_MAP.P1).toBe(1);
      expect(PRIORITY_MAP.P2).toBe(2);
      expect(PRIORITY_MAP.P3).toBe(3);
      expect(PRIORITY_MAP.P4).toBe(4);
      expect(PRIORITY_MAP.P5).toBe(5);
    });
  });

  describe('STATUS_MAP', () => {
    it('should map test outcomes', () => {
      expect(STATUS_MAP.passed).toBe(2);
      expect(STATUS_MAP.failed).toBe(3);
      expect(STATUS_MAP.skipped).toBe(1);
    });
  });
});
