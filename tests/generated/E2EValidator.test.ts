import { describe, it, expect, vi } from 'vitest';
import { E2EValidator } from '../../src/validators/E2EValidator';

describe('E2EValidator', () => {
  describe('constructor', () => {
    it('should use default options', () => {
      const validator = new E2EValidator();
      expect(validator).toBeDefined();
    });

    it('should use custom options', () => {
      const validator = new E2EValidator({ timeoutMs: 5000, headless: false });
      expect(validator).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should return invalid result for non-existent URL', async () => {
      const validator = new E2EValidator();
      const result = await validator.validate('http://localhost:9999/nonexistent');
      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
    });
  });
});
