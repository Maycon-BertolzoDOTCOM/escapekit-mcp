import { describe, it, expect } from 'vitest';
import { LockFileParser } from '../../src/security/LockFileParser';

describe('LockFileParser', () => {
  describe('constructor', () => {
    it('should create parser', () => {
      const parser = new LockFileParser();
      expect(parser).toBeDefined();
    });
  });

  describe('parse', () => {
    it('should return error for non-existent file', async () => {
      const parser = new LockFileParser();
      const result = await parser.parse('/nonexistent/package-lock.json');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('FILE_NOT_FOUND');
      }
    });
  });

  describe('parseContent', () => {
    it('should return error for empty content', async () => {
      const parser = new LockFileParser();
      const result = await parser.parseContent('', 'npm-v2');
      expect(result.success).toBe(false);
    });
  });
});
