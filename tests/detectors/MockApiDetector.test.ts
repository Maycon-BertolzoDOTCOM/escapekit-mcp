/**
 * MockApiDetector Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockApiDetector, createMockApiDetector } from '../../src/detectors/MockApiDetector.js';

describe('MockApiDetector', () => {
  let detector: MockApiDetector;

  beforeEach(() => {
    detector = createMockApiDetector();
  });

  describe('detect', () => {
    it('should detect mockapi.io calls', () => {
      const code = `
        fetch('https://mockapi.io/users')
          .then(res => res.json())
          .then(data => console.log(data));
      `;
      
      const results = detector.detect(code);
      
      expect(results).toHaveLength(1);
      expect(results[0].function).toBe('mockapi.io');
      expect(results[0].endpoint).toContain('mockapi.io');
    });

    it('should detect jsonplaceholder calls', () => {
      const code = `
        fetch('https://jsonplaceholder.typicode.com/posts')
          .then(res => res.json());
      `;
      
      const results = detector.detect(code);
      
      expect(results).toHaveLength(1);
      expect(results[0].function).toBe('jsonplaceholder');
      expect(results[0].endpoint).toContain('jsonplaceholder.typicode.com');
    });

    it('should detect localhost URLs', () => {
      const code = `
        fetch('http://localhost:3000/api/users');
        fetch('http://localhost:8080/data');
      `;
      
      const results = detector.detect(code);
      
      expect(results).toHaveLength(2);
      results.forEach(r => {
        expect(r.function).toBe('localhost');
      });
    });

    it('should detect 127.0.0.1 URLs', () => {
      const code = `
        fetch('http://127.0.0.1:5000/api');
      `;
      
      const results = detector.detect(code);
      
      expect(results).toHaveLength(1);
      expect(results[0].function).toBe('localhost');
    });

    it('should return empty array when no mock APIs are found', () => {
      const code = `
        import React from 'react';
        import { useState } from 'react';
        
        export function App() {
          return <div>Hello</div>;
        }
      `;
      
      const results = detector.detect(code);
      
      expect(results).toHaveLength(0);
    });

    it('should detect multiple mock API calls', () => {
      const code = `
        const api1 = fetch('https://mockapi.io/users');
        const api2 = fetch('https://jsonplaceholder.typicode.com/posts');
        const api3 = fetch('http://localhost:3000/data');
      `;
      
      const results = detector.detect(code);
      
      expect(results).toHaveLength(3);
      expect(results[0].function).toBe('mockapi.io');
      expect(results[1].function).toBe('jsonplaceholder');
      expect(results[2].function).toBe('localhost');
    });

    it('should capture line and column positions', () => {
      const code = `
const data = fetch('https://mockapi.io/users');
`;
      
      const results = detector.detect(code);
      
      expect(results).toHaveLength(1);
      expect(results[0].line).toBe(2);
      expect(results[0].column).toBeGreaterThan(0);
    });
  });

  describe('addPattern', () => {
    it('should add custom pattern', () => {
      const customPattern = {
        pattern: /custom-mock\.api/i,
        type: 'custom-mock',
      };
      
      detector.addPattern(customPattern);
      
      const code = "fetch('https://custom-mock.api/data')";
      const results = detector.detect(code);
      
      expect(results).toHaveLength(1);
      expect(results[0].function).toBe('custom-mock');
    });
  });

  describe('clearPatterns', () => {
    it('should clear all patterns', () => {
      const code = "fetch('https://mockapi.io/users')";
      
      // First, verify detection works
      expect(detector.detect(code)).toHaveLength(1);
      
      // Clear patterns
      detector.clearPatterns();
      
      // Now it should not detect anything
      expect(detector.detect(code)).toHaveLength(0);
    });
  });

  describe('getPatterns', () => {
    it('should return all patterns', () => {
      const patterns = detector.getPatterns();
      
      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThan(0);
      patterns.forEach(p => {
        expect(p).toHaveProperty('pattern');
        expect(p).toHaveProperty('type');
        expect(p.pattern).toBeInstanceOf(RegExp);
        expect(typeof p.type).toBe('string');
      });
    });
  });

  describe('isMockApi', () => {
    it('should return true for mock API URLs', () => {
      expect(detector.isMockApi('https://mockapi.io/users')).toBe(true);
      expect(detector.isMockApi('https://jsonplaceholder.typicode.com/posts')).toBe(true);
      expect(detector.isMockApi('http://localhost:3000/api')).toBe(true);
      expect(detector.isMockApi('http://127.0.0.1:5000/data')).toBe(true);
    });

    it('should return false for real API URLs', () => {
      expect(detector.isMockApi('https://api.github.com/users')).toBe(false);
      expect(detector.isMockApi('https://api.example.com/data')).toBe(false);
    });
  });

  describe('getMockApiType', () => {
    it('should return correct mock API type', () => {
      expect(detector.getMockApiType('https://mockapi.io/users')).toBe('mockapi.io');
      expect(detector.getMockApiType('https://jsonplaceholder.typicode.com/posts')).toBe('jsonplaceholder');
      expect(detector.getMockApiType('http://localhost:3000/api')).toBe('localhost');
    });

    it('should return null for non-mock APIs', () => {
      expect(detector.getMockApiType('https://api.github.com/users')).toBeNull();
    });
  });
});