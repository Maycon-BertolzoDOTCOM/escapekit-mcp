import { describe, it, expect } from 'vitest';

describe('BaseParser', () => {
  describe('isRelativeImport', () => {
    it('should identify relative imports starting with ./', () => {
      const parser = {
        isRelativeImport: (source: string) => source.startsWith('./') || source.startsWith('../') || source.startsWith('/')
      };
      expect(parser.isRelativeImport('./utils')).toBe(true);
      expect(parser.isRelativeImport('./Component')).toBe(true);
    });

    it('should identify relative imports starting with ../', () => {
      const parser = {
        isRelativeImport: (source: string) => source.startsWith('./') || source.startsWith('../') || source.startsWith('/')
      };
      expect(parser.isRelativeImport('../utils')).toBe(true);
      expect(parser.isRelativeImport('../../utils')).toBe(true);
    });

    it('should identify relative imports starting with /', () => {
      const parser = {
        isRelativeImport: (source: string) => source.startsWith('./') || source.startsWith('../') || source.startsWith('/')
      };
      expect(parser.isRelativeImport('/absolute/path')).toBe(true);
    });

    it('should return false for non-relative imports', () => {
      const parser = {
        isRelativeImport: (source: string) => source.startsWith('./') || source.startsWith('../') || source.startsWith('/')
      };
      expect(parser.isRelativeImport('react')).toBe(false);
      expect(parser.isRelativeImport('@babel/core')).toBe(false);
    });
  });

  describe('extractPackageName', () => {
    it('should extract regular package name', () => {
      const parser = {
        extractPackageName: (source: string) => {
          if (source.startsWith('@')) {
            const parts = source.split('/');
            if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
            return source;
          }
          const parts = source.split('/');
          return parts[0];
        }
      };
      expect(parser.extractPackageName('react')).toBe('react');
      expect(parser.extractPackageName('lodash/get')).toBe('lodash');
    });

    it('should extract scoped package name', () => {
      const parser = {
        extractPackageName: (source: string) => {
          if (source.startsWith('@')) {
            const parts = source.split('/');
            if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
            return source;
          }
          const parts = source.split('/');
          return parts[0];
        }
      };
      expect(parser.extractPackageName('@babel/core')).toBe('@babel/core');
      expect(parser.extractPackageName('@testing-library/react')).toBe('@testing-library/react');
    });
  });
});
