import { describe, it, expect } from 'vitest';
import { MockApiDetector, createMockApiDetector } from '../../src/detectors/MockApiDetector.ts';

describe('MockApiDetector', () => {
  describe('detect', () => {
    it('should detect mock APIs', () => {
      const detector = createMockApiDetector();
      const code = 'fetch("https://mockapi.io/users")';
      const result = detector.detect(code);
      expect(result).toHaveLength(1);
      expect(result[0].function).toBe('mockapi.io');
    });

    it('should handle multiple mock APIs', () => {
      const detector = new MockApiDetector();
      const code = 'fetch("https://mockapi.io/users"); fetch("https://jsonplaceholder.typicode.com/posts")';
      const result = detector.detect(code);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should not detect real APIs', () => {
      const detector = createMockApiDetector();
      const code = 'fetch("https://api.github.com/users")';
      const result = detector.detect(code);
      expect(result).toHaveLength(0);
    });

    it('should detect localhost URLs', () => {
      const detector = new MockApiDetector();
      const code = 'fetch("http://localhost:3000/api")';
      const result = detector.detect(code);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('addPattern', () => {
    it('should add custom pattern', () => {
      const detector = new MockApiDetector([]);
      detector.addPattern({ pattern: /test.api/i, type: 'test' });
      const patterns = detector.getPatterns();
      expect(patterns).toHaveLength(1);
    });
  });

  describe('isMockApi', () => {
    it('should identify mock APIs', () => {
      const detector = createMockApiDetector();
      expect(detector.isMockApi('https://mockapi.io/users')).toBe(true);
      expect(detector.isMockApi('https://api.github.com')).toBe(false);
    });
  });
});
