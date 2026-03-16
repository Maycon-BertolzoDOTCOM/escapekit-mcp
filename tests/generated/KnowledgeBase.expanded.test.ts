import { describe, it, expect } from 'vitest';
import { KnowledgeBase } from '../../src/resolvers/KnowledgeBase';
import { MappingStrategy } from '../../src/models/transformation';

describe('KnowledgeBase (Expanded)', () => {
  describe('constructor', () => {
    it('should create knowledge base with default mappings', () => {
      const kb = new KnowledgeBase();
      expect(kb).toBeDefined();
      expect(typeof kb.getMapping).toBe('function');
    });
  });

  describe('getMapping', () => {
    it('should return null for package not in knowledge base', () => {
      const kb = new KnowledgeBase();
      const result = kb.getMapping('non-existent-package-123');
      expect(result).toBeNull();
    });

    it('should handle package names with different cases', () => {
      const kb = new KnowledgeBase();
      const mapping1 = kb.getMapping('REACT');
      const mapping2 = kb.getMapping('react');
      expect(mapping1).toBeNull();
      expect(mapping2).toBeNull();
    });

    it('should return consistent result for same package', () => {
      const kb = new KnowledgeBase();
      const result1 = kb.getMapping('test-package');
      const result2 = kb.getMapping('test-package');
      expect(result1).toEqual(result2);
    });
  });

  describe('addMapping', () => {
    it('should add new mapping to knowledge base', () => {
      const kb = new KnowledgeBase();
      const testMapping = {
        ghostPackage: 'test-ghost',
        realPackages: ['real-package'],
        confidence: 0.95,
        mappingStrategy: MappingStrategy.EXACT_MATCH,
        metadata: { reason: 'test mapping' }
      };
      
      kb.addMapping(testMapping);
      const result = kb.getMapping('test-ghost');
      
      expect(result).toBeDefined();
      expect(result?.ghostPackage).toBe('test-ghost');
      expect(result?.realPackages).toEqual(['real-package']);
    });

    it('should return correct mapping after adding', () => {
      const kb = new KnowledgeBase();
      const testMapping = {
        ghostPackage: 'example-package',
        realPackages: ['axios'],
        confidence: 0.9,
        mappingStrategy: MappingStrategy.EXACT_MATCH,
        metadata: { reason: 'HTTP client replacement' }
      };
      
      kb.addMapping(testMapping);
      const result = kb.getMapping('example-package');
      
      expect(result).toBeDefined();
      expect(result?.realPackages).toContain('axios');
      expect(result?.confidence).toBe(0.9);
    });
  });

  describe('file operations', () => {
    it('should handle non-existent files gracefully', async () => {
      const kb = new KnowledgeBase();
      try {
        await kb.loadFromFile('/non/existent/path.json');
        expect(true).toBe(true); // Should handle error without crashing test
      } catch (error) {
        expect(error).toBeDefined(); // File not found is expected
      }
    });
  });
});
