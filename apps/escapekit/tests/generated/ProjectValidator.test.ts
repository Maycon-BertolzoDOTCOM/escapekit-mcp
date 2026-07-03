import { describe, it, expect } from 'vitest';
import { ProjectValidator } from '../../src/validators/ProjectValidator';

describe('ProjectValidator', () => {
  describe('constructor', () => {
    it('should create validator', () => {
      const validator = new ProjectValidator();
      expect(validator).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should return invalid result for non-existent path', async () => {
      const validator = new ProjectValidator();
      const result = await validator.validate('/nonexistent/path');
      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
    });
  });
});
