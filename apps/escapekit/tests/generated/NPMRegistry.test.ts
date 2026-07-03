import { describe, it, expect, vi } from 'vitest';
import { NPMRegistry } from '../../src/services/NPMRegistry';

describe('NPMRegistry', () => {
  describe('constructor', () => {
    it('should use default config', () => {
      const registry = new NPMRegistry();
      expect(registry).toBeDefined();
    });

    it('should use custom config', () => {
      const registry = new NPMRegistry({ enableRetry: false });
      expect(registry).toBeDefined();
    });
  });

  describe('isNodeBuiltin', () => {
    it('should identify Node.js built-in modules', () => {
      const registry = new NPMRegistry();
      expect(registry.isNodeBuiltin('fs')).toBe(true);
      expect(registry.isNodeBuiltin('path')).toBe(true);
      expect(registry.isNodeBuiltin('http')).toBe(true);
    });

    it('should return false for non-built-in modules', () => {
      const registry = new NPMRegistry();
      expect(registry.isNodeBuiltin('axios')).toBe(false);
      expect(registry.isNodeBuiltin('react')).toBe(false);
      expect(registry.isNodeBuiltin('fake-package')).toBe(false);
    });
  });

  describe('packageExists', () => {
    it('should return true for Node.js built-in modules', async () => {
      const registry = new NPMRegistry();
      const result = await registry.packageExists('fs');
      expect(result).toBe(true);
    });

    it('should return false for non-existent package', async () => {
      const registry = new NPMRegistry({ enableRetry: false });
      const result = await registry.packageExists('fake-package-xyz-12345');
      expect(result).toBe(false);
    });

    it('should use cache for repeated calls', async () => {
      const registry = new NPMRegistry();
      await registry.packageExists('fake-package-xyz-12345');
      const result = await registry.packageExists('fake-package-xyz-12345');
      expect(result).toBe(false);
    });
  });
});
