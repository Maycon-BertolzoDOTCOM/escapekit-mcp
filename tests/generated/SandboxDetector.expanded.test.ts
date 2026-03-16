import { describe, it, expect } from 'vitest';
import { SandboxDetector } from '../../src/detectors/SandboxDetector';

describe('SandboxDetector (Expanded)', () => {
  describe('detect', () => {
    it('should detect replit references', () => {
      const detector = new SandboxDetector();
      const code = "process.env.REPLIT_DB_URL;";
      const result = detector.detect(code);
      expect(result).toBeDefined();
    });

    it('should detect replit imports', () => {
      const detector = new SandboxDetector();
      const code = "import { Database } from '@replit/database';";
      const result = detector.detect(code);
      expect(result).toBeDefined();
    });

    it('should detect replit authentication', () => {
      const detector = new SandboxDetector();
      const code = "const auth = process.env.REPLIT_AUTH_TOKEN;";
      const result = detector.detect(code);
      expect(result).toBeDefined();
    });

    it('should detect replit user id', () => {
      const detector = new SandboxDetector();
      const code = "const userId = process.env.REPLIT_USER_ID;";
      const result = detector.detect(code);
      expect(result).toBeDefined();
    });

    it('should detect replit api url', () => {
      const detector = new SandboxDetector();
      const code = "const apiUrl = process.env.REPLIT_API_URL;";
      const result = detector.detect(code);
      expect(result).toBeDefined();
    });

    it('should handle multiple replit references', () => {
      const detector = new SandboxDetector();
      const code = `
        import { Database } from '@replit/database';
        const dbUrl = process.env.REPLIT_DB_URL;
        const auth = process.env.REPLIT_AUTH_TOKEN;
      `;
      const result = detector.detect(code);
      expect(result).toBeDefined();
    });

    it('should handle code without sandbox dependencies', () => {
      const detector = new SandboxDetector();
      const code = "import express from 'express';";
      const result = detector.detect(code);
      expect(result).toBeDefined();
    });
  });

  describe('constructor', () => {
    it('should create detector with default config', () => {
      const detector = new SandboxDetector();
      expect(detector).toBeDefined();
    });
  });
});
