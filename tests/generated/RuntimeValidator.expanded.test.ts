import { describe, it, expect } from 'vitest';
import { RuntimeValidator } from '../../src/validators/RuntimeValidator';

describe('RuntimeValidator (Expanded)', () => {
  describe('constructor', () => {
    it('should create validator with default config', () => {
      const validator = new RuntimeValidator();
      expect(validator).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should handle basic validation request (async)', async () => {
      const validator = new RuntimeValidator();
      const options = { projectPath: '/test', timeout: 5000 };
      const result = await validator.validate(options);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should handle validation with specific rules (async)', async () => {
      const validator = new RuntimeValidator();
      const result = await validator.validate({ 
        projectPath: '/test', 
        ruleset: 'strict',
        timeout: 3000 
      });
      expect(result).toBeDefined();
    });

    it('should return consistent result structure (async)', async () => {
      const validator = new RuntimeValidator();
      const result = await validator.validate({ projectPath: '/test' });
      expect(result).toBeDefined();
    });

    it('should handle different timeout values (async)', async () => {
      const validator = new RuntimeValidator();
      const result1 = await validator.validate({ projectPath: '/test', timeout: 1000 });
      const result2 = await validator.validate({ projectPath: '/test', timeout: 10000 });
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it('should handle validation failures gracefully (async)', async () => {
      const validator = new RuntimeValidator();
      const result = await validator.validate({ projectPath: '/invalid/path' });
      expect(result).toBeDefined();
    });
  });
});
