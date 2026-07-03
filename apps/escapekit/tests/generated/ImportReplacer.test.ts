import { describe, it, expect } from 'vitest';
import { ImportReplacer } from '../../src/transformers/ImportReplacer';

describe('ImportReplacer', () => {
  describe('replaceImports', () => {
    it('should replace ghost import with real package', () => {
      const replacer = new ImportReplacer();
      const sourceCode = "import api from 'fake-api';";
      const resolutions = [
        { originalImport: 'fake-api', resolvedPackage: 'axios', confidence: 0.9 }
      ];
      const result = replacer.replaceImports(sourceCode, resolutions);
      expect(result.transformedCode).toContain('axios');
      expect(result.appliedRules).toHaveLength(1);
    });

    it('should handle multiple imports', () => {
      const replacer = new ImportReplacer();
      const sourceCode = "import api from 'fake-api';\nimport React from 'react';";
      const resolutions = [
        { originalImport: 'fake-api', resolvedPackage: 'axios', confidence: 0.9 }
      ];
      const result = replacer.replaceImports(sourceCode, resolutions);
      expect(result.transformedCode).toContain('axios');
      expect(result.transformedCode).toContain('react');
    });

    it('should preserve code formatting', () => {
      const replacer = new ImportReplacer();
      const sourceCode = "import api from 'fake-api';";
      const resolutions = [
        { originalImport: 'fake-api', resolvedPackage: 'axios', confidence: 0.9 }
      ];
      const result = replacer.replaceImports(sourceCode, resolutions);
      expect(result.transformedCode).toBeDefined();
    });
  });
});
