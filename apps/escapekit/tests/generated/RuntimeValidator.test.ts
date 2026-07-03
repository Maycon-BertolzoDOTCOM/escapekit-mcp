import { describe, it, expect } from 'vitest';
import { RuntimeValidator } from '../../src/validators/RuntimeValidator.ts';

describe('RuntimeValidator', () => {
  describe('constructor', () => {
    it('should use default timeouts', () => {
      const validator = new RuntimeValidator();
      expect(validator).toBeDefined();
    });

    it('should use custom timeouts', () => {
      const validator = new RuntimeValidator({
        installTimeoutMs: 30000,
        bootTimeoutMs: 10000
      });
      expect(validator).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should return validation result', async () => {
      const validator = new RuntimeValidator();
      const result = await validator.validate('/nonexistent/path');
      expect(result).toBeDefined();
      expect(result.valid).toBe(false);
      expect(result.installSuccess).toBe(false);
      expect(result.bootSuccess).toBe(false);
    });
  });
});
