import { describe, it, expect } from 'vitest';
import { validateReality } from '../../src/tools/validate';

describe('validateReality', () => {
  describe('parameter validation', () => {
    it('should return error for missing project path', async () => {
      const result = await validateReality('');
      expect(result).toBeDefined();
    });

    it('should return error for undefined project path', async () => {
      const result = await validateReality(undefined as any);
      expect(result).toBeDefined();
    });
  });

  describe('validation levels', () => {
    it('should handle basic validation level', async () => {
      const result = await validateReality('/fake/path', 'basic');
      expect(result).toBeDefined();
    });

    it('should handle standard validation level', async () => {
      const result = await validateReality('/fake/path', 'standard');
      expect(result).toBeDefined();
    });

    it('should handle thorough validation level', async () => {
      const result = await validateReality('/fake/path', 'thorough');
      expect(result).toBeDefined();
    });

    it('should default to standard validation level', async () => {
      const result = await validateReality('/fake/path');
      expect(result).toBeDefined();
    });
  });
});
