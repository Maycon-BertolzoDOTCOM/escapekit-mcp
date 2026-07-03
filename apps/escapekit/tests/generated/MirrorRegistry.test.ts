import { describe, it, expect } from 'vitest';
import { MirrorRegistry } from '../../src/mirrors/MirrorRegistry';

describe('MirrorRegistry', () => {
  describe('constructor', () => {
    it('should create registry with default mirrors', () => {
      const registry = new MirrorRegistry();
      expect(registry).toBeDefined();
      const mirrors = registry.getMirrors();
      expect(mirrors.length).toBeGreaterThan(0);
    });

    it('should create registry with Chinese mirrors disabled', () => {
      const registry = new MirrorRegistry({ enableChineseMirrors: false });
      expect(registry).toBeDefined();
      const mirrors = registry.getMirrors();
      expect(mirrors.some(m => m.name === 'npmjs')).toBe(true);
    });
  });

  describe('getMirrors', () => {
    it('should return mirrors sorted by priority', () => {
      const registry = new MirrorRegistry();
      const mirrors = registry.getMirrors();
      for (let i = 1; i < mirrors.length; i++) {
        expect(mirrors[i].priority).toBeGreaterThanOrEqual(mirrors[i - 1].priority);
      }
    });
  });

  describe('checkMirror', () => {
    it('should return false for non-existent mirror', async () => {
      const registry = new MirrorRegistry();
      const result = await registry.checkMirror('non-existent');
      expect(result).toBe(false);
    });
  });
});
