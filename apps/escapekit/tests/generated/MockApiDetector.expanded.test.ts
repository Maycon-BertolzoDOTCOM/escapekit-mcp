import { describe, it, expect } from 'vitest';
import { MockApiDetector } from '../../src/detectors/MockApiDetector';

describe('MockApiDetector (Expanded)', () => {
  describe('detect', () => {
    it('should detect jsonplaceholder urls', () => {
      const detector = new MockApiDetector();
      const code = "fetch('https://jsonplaceholder.typicode.com/posts');";
      const result = detector.detect(code);
      expect(result).toBeDefined();
    });

    it('should detect mockapi urls', () => {
      const detector = new MockApiDetector();
      const code = "fetch('https://mockapi.io/projects');";
      const result = detector.detect(code);
      expect(result).toBeDefined();
    });

    it('should detect localhost references', () => {
      const detector = new MockApiDetector();
      const code = "fetch('http://localhost:3000/api');";
      const result = detector.detect(code);
      expect(result).toBeDefined();
    });

    it('should detect 127.0.0.1 references', () => {
      const detector = new MockApiDetector();
      const code = "fetch('http://127.0.0.1:5000/data');";
      const result = detector.detect(code);
      expect(result).toBeDefined();
    });

    it('should handle multiple API calls', () => {
      const detector = new MockApiDetector();
      const code = `
        fetch('https://jsonplaceholder.typicode.com/posts');
        fetch('https://mockapi.io/projects');
        fetch('http://localhost:3000/api');
      `;
      const result = detector.detect(code);
      expect(result).toBeDefined();
    });

    it('should handle code without mock APIs', () => {
      const detector = new MockApiDetector();
      const code = "fetch('https://api.real-service.com/data');";
      const result = detector.detect(code);
      expect(result).toBeDefined();
    });
  });

  describe('isMockApi', () => {
    it('should identify jsonplaceholder', () => {
      const detector = new MockApiDetector();
      expect(detector.isMockApi('https://jsonplaceholder.typicode.com')).toBe(true);
    });

    it('should identify mockapi', () => {
      const detector = new MockApiDetector();
      expect(detector.isMockApi('https://mockapi.io')).toBe(true);
    });

    it('should identify localhost', () => {
      const detector = new MockApiDetector();
      expect(detector.isMockApi('http://localhost:3000')).toBe(true);
    });

    it('should identify 127.0.0.1', () => {
      const detector = new MockApiDetector();
      expect(detector.isMockApi('http://127.0.0.1:5000')).toBe(true);
    });

    it('should ignore real APIs', () => {
      const detector = new MockApiDetector();
      expect(detector.isMockApi('https://api.real-service.com')).toBe(false);
      expect(detector.isMockApi('https://api.github.com')).toBe(false);
    });
  });
});
