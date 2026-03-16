import { describe, it, expect } from 'vitest';
import { KnowledgeBase } from '../../src/resolvers/KnowledgeBase.ts';

describe('KnowledgeBase', () => {
  describe('getMapping', () => {
    it('should return null for unknown package', () => {
      const kb = new KnowledgeBase();
      const result = kb.getMapping('unknown-package');
      expect(result).toBeNull();
    });

    it('should return mapping for known package', () => {
      const kb = new KnowledgeBase();
      kb.addMapping({
        ghostPackage: 'three.js',
        realPackages: ['three'],
        confidence: 0.95,
        mappingStrategy: 'exact_match',
        metadata: { reason: 'Common 3D library' }
      });
      const result = kb.getMapping('three.js');
      expect(result).not.toBeNull();
      expect(result.realPackages[0]).toBe('three');
    });
  });

  describe('addMapping', () => {
    it('should add new mapping', () => {
      const kb = new KnowledgeBase();
      kb.addMapping({
        ghostPackage: 'fake-api',
        realPackages: ['axios'],
        confidence: 0.9,
        mappingStrategy: 'exact_match',
        metadata: {}
      });
      const result = kb.getMapping('fake-api');
      expect(result).not.toBeNull();
    });

    it('should overwrite existing mapping', () => {
      const kb = new KnowledgeBase();
      kb.addMapping({
        ghostPackage: 'three.js',
        realPackages: ['three'],
        confidence: 0.9,
        mappingStrategy: 'exact_match',
        metadata: {}
      });
      kb.addMapping({
        ghostPackage: 'three.js',
        realPackages: ['three-2'],
        confidence: 0.95,
        mappingStrategy: 'exact_match',
        metadata: {}
      });
      const result = kb.getMapping('three.js');
      expect(result.realPackages[0]).toBe('three-2');
    });
  });

  describe('clear', () => {
    it('should clear all mappings', () => {
      const kb = new KnowledgeBase();
      kb.addMapping({
        ghostPackage: 'three.js',
        realPackages: ['three'],
        confidence: 0.9,
        mappingStrategy: 'exact_match',
        metadata: {}
      });
      kb.clear();
      const result = kb.getMapping('three.js');
      expect(result).toBeNull();
    });
  });

  describe('size', () => {
    it('should return number of mappings', () => {
      const kb = new KnowledgeBase();
      kb.addMapping({
        ghostPackage: 'three.js',
        realPackages: ['three'],
        confidence: 0.9,
        mappingStrategy: 'exact_match',
        metadata: {}
      });
      kb.addMapping({
        ghostPackage: 'fake-api',
        realPackages: ['axios'],
        confidence: 0.9,
        mappingStrategy: 'exact_match',
        metadata: {}
      });
      const count = kb.size();
      expect(count).toBe(2);
    });
  });
});
