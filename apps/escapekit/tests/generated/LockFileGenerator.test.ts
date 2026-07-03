import { describe, it, expect } from 'vitest';
import { LockFileGenerator } from '../../src/lockfile/LockFileGenerator';

describe('LockFileGenerator', () => {
  describe('constructor', () => {
    it('should create generator', () => {
      const generator = new LockFileGenerator();
      expect(generator).toBeDefined();
    });
  });

  describe('generate', () => {
    it('should generate lock file from dependencies', () => {
      const generator = new LockFileGenerator();
      const dependencies = new Map([
        ['react', '^18.0.0'],
        ['lodash', '^4.17.21']
      ]);
      const lockFile = generator.generate('test-project', '1.0.0', dependencies);
      expect(lockFile).toBeDefined();
      expect(lockFile.name).toBe('test-project');
      expect(lockFile.version).toBe('1.0.0');
      expect(Object.keys(lockFile.packages).length).toBe(2);
    });

    it('should generate lock file for empty dependencies', () => {
      const generator = new LockFileGenerator();
      const dependencies = new Map();
      const lockFile = generator.generate('test-project', '1.0.0', dependencies);
      expect(lockFile).toBeDefined();
      expect(Object.keys(lockFile.packages).length).toBe(0);
    });
  });

  describe('calculateIntegrity', () => {
    it('should calculate integrity hash', () => {
      const generator = new LockFileGenerator();
      const integrity = generator.calculateIntegrity('react', '18.0.0');
      expect(integrity).toBeDefined();
      expect(integrity).toMatch(/^sha256-/);
    });

    it('should generate consistent hashes', () => {
      const generator = new LockFileGenerator();
      const hash1 = generator.calculateIntegrity('react', '18.0.0');
      const hash2 = generator.calculateIntegrity('react', '18.0.0');
      expect(hash1).toBe(hash2);
    });
  });

  describe('validate', () => {
    it('should return invalid for non-existent file', async () => {
      const generator = new LockFileGenerator();
      const result = await generator.validate('/nonexistent/package-lock.json');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
