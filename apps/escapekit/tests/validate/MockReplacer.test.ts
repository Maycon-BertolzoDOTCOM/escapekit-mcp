import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockReplacer } from '../../src/validate/auto-fix/MockReplacer.js';
import { KnowledgeBase } from '../../src/resolvers/KnowledgeBase.js';
import { SemanticMatcher } from '../../src/resolvers/SemanticMatcher.js';
import { NPMRegistry } from '../../src/services/NPMRegistry.js';

describe('MockReplacer', () => {
  let mockReplacer: MockReplacer;
  let knowledgeBase: KnowledgeBase;
  let semanticMatcher: SemanticMatcher;
  let npmRegistry: NPMRegistry;

  beforeEach(() => {
    knowledgeBase = new KnowledgeBase();
    semanticMatcher = new SemanticMatcher(new NPMRegistry());
    npmRegistry = new NPMRegistry();
    
    // Reset mocks
    vi.restoreAllMocks();
  });

  describe('resolveReplacement', () => {
    it('should use KnowledgeBase mapping when available', async () => {
      // Setup KnowledgeBase mock
      vi.spyOn(knowledgeBase, 'getMapping').mockReturnValue({
        ghostPackage: 'fake-api',
        realPackages: ['axios'],
        confidence: 0.95,
        mappingStrategy: 'EXACT_MATCH',
        metadata: { reason: 'Test mapping' }
      });
      
      mockReplacer = new MockReplacer({ knowledgeBase });
      const result = await mockReplacer['resolveReplacement']('fake-api');
      
      expect(result).toEqual({
        realPackage: 'axios',
        strategy: 'knowledge-base'
      });
    });

    it('should use SemanticMatcher when KnowledgeBase has no match', async () => {
      // Setup mocks
      vi.spyOn(knowledgeBase, 'getMapping').mockReturnValue(null);
      vi.spyOn(semanticMatcher, 'findSimilar').mockResolvedValue([{
        ghostPackage: 'fake-api',
        realPackages: ['axios'],
        confidence: 0.85,
        mappingStrategy: 'SEMANTIC_MATCH',
        metadata: { reason: 'Test semantic match' }
      }]);
      
      mockReplacer = new MockReplacer({ knowledgeBase, semanticMatcher });
      const result = await mockReplacer['resolveReplacement']('fake-api');
      
      expect(result).toEqual({
        realPackage: 'axios',
        strategy: 'semantic-match'
      });
    });

    it('should verify package exists in NPM registry when other strategies fail', async () => {
      // Setup mocks
      vi.spyOn(knowledgeBase, 'getMapping').mockReturnValue(null);
      vi.spyOn(semanticMatcher, 'findSimilar').mockResolvedValue([]);
      vi.spyOn(npmRegistry, 'packageExists').mockResolvedValue(true);
      
      mockReplacer = new MockReplacer({ knowledgeBase, semanticMatcher, npmRegistry });
      const result = await mockReplacer['resolveReplacement']('fake-api');
      
      expect(result).toEqual({
        realPackage: 'fake-api',
        strategy: 'npm-registry-verified'
      });
    });

    it('should fallback to hardcoded replacements when all else fails', async () => {
      // Setup mocks
      vi.spyOn(knowledgeBase, 'getMapping').mockReturnValue(null);
      vi.spyOn(semanticMatcher, 'findSimilar').mockResolvedValue([]);
      vi.spyOn(npmRegistry, 'packageExists').mockResolvedValue(false);
      
      mockReplacer = new MockReplacer({ knowledgeBase, semanticMatcher, npmRegistry });
      const result = await mockReplacer['resolveReplacement']('fake-api');
      
      expect(result).toEqual({
        realPackage: 'axios',
        strategy: 'hardcoded'
      });
    });
  });

  describe('fix', () => {
    it('should handle npm-registry-verified strategy by returning not applied', async () => {
      // Setup mocks
      vi.spyOn(knowledgeBase, 'getMapping').mockReturnValue(null);
      vi.spyOn(semanticMatcher, 'findSimilar').mockResolvedValue([]);
      vi.spyOn(npmRegistry, 'packageExists').mockResolvedValue(true);
      
      mockReplacer = new MockReplacer({ knowledgeBase, semanticMatcher, npmRegistry });
      // Mock file access so the file existence check passes
      mockReplacer['access'] = vi.fn().mockResolvedValue(undefined);
      const result = await mockReplacer.fix('/project', {
        type: 'GHOST_IMPORT',
        file: 'src/file.ts',
        message: 'Ghost import detected: "fake-api" in src/file.ts:5'
      });
      
      expect(result.applied).toBe(false);
      expect(result.description).toContain('Package exists in registry but not auto-replaced');
    });

    it('should apply replacement when valid strategy is found', async () => {
      // Setup mocks
      vi.spyOn(knowledgeBase, 'getMapping').mockReturnValue({
        ghostPackage: 'fake-api',
        realPackages: ['axios'],
        confidence: 0.95,
        mappingStrategy: 'EXACT_MATCH',
        metadata: { reason: 'Test mapping' }
      });
      
      // Mock file operations
      const mockReadFile = vi.fn().mockResolvedValue('import { get } from "fake-api";');
      const mockWriteFile = vi.fn().mockResolvedValue(undefined);
      const mockAccess = vi.fn().mockResolvedValue(undefined);
      
      mockReplacer = new MockReplacer({ knowledgeBase });
      
      // Replace file operations with mocks
      mockReplacer['readFile'] = mockReadFile;
      mockReplacer['writeFile'] = mockWriteFile;
      mockReplacer['access'] = mockAccess;
      
      const result = await mockReplacer.fix('/project', {
        type: 'GHOST_IMPORT',
        file: 'src/file.ts',
        message: 'Ghost import detected: "fake-api" in src/file.ts:5'
      });
      
      expect(result.applied).toBe(true);
      expect(mockWriteFile).toHaveBeenCalled();
    });
  });

  describe('lazy KnowledgeBase initialization', () => {
    it('should load knowledge-base.json on first resolveReplacement call', async () => {
      const loadSpy = vi.spyOn(knowledgeBase, 'loadFromFile').mockResolvedValue(undefined);
      
      mockReplacer = new MockReplacer({ knowledgeBase });
      
      // First call should trigger load
      await mockReplacer['resolveReplacement']('fake-api');
      expect(loadSpy).toHaveBeenCalledWith('knowledge-base.json');
      
      // Second call should not trigger load again
      loadSpy.mockClear();
      await mockReplacer['resolveReplacement']('fake-api');
      expect(loadSpy).not.toHaveBeenCalled();
    });

    it('should continue without KnowledgeBase if loading fails', async () => {
      vi.spyOn(knowledgeBase, 'loadFromFile').mockRejectedValue(new Error('Failed to load'));
      
      mockReplacer = new MockReplacer({ knowledgeBase });
      await expect(mockReplacer['resolveReplacement']('fake-api')).resolves.not.toThrow();
    });
  });
});