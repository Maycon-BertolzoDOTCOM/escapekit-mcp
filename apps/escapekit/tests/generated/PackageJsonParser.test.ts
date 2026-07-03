import { describe, it, expect } from 'vitest';
import { PackageJsonParser } from '../../src/security/PackageJsonParser';

describe('PackageJsonParser', () => {
  describe('constructor', () => {
    it('should create parser', () => {
      const parser = new PackageJsonParser();
      expect(parser).toBeDefined();
    });
  });

  describe('parse', () => {
    it('should parse valid package.json', () => {
      const parser = new PackageJsonParser();
      const content = '{"name": "test"}';
      const result = parser.parse(content);
      expect(result).toBeDefined();
      expect(result.name).toBe('test');
    });

    it('should throw error for invalid JSON', () => {
      const parser = new PackageJsonParser();
      expect(() => parser.parse('{invalid}')).toThrow();
    });
  });

  describe('extractScripts', () => {
    it('should return empty array for no scripts', () => {
      const parser = new PackageJsonParser();
      const packageJson = { name: 'test' };
      const result = parser.extractScripts(packageJson);
      expect(result).toEqual([]);
    });

    it('should extract postinstall scripts', () => {
      const parser = new PackageJsonParser();
      const packageJson = {
        name: 'test',
        scripts: { postinstall: 'echo "hello"' }
      };
      const result = parser.extractScripts(packageJson);
      expect(result.length).toBe(1);
      expect(result[0].type).toBe('postinstall');
    });
  });

  describe('extractDependencies', () => {
    it('should return empty array for no dependencies', () => {
      const parser = new PackageJsonParser();
      const packageJson = { name: 'test' };
      const result = parser.extractDependencies(packageJson);
      expect(result).toEqual([]);
    });

    it('should extract dependencies', () => {
      const parser = new PackageJsonParser();
      const packageJson = {
        name: 'test',
        dependencies: { react: '^18.0.0' }
      };
      const result = parser.extractDependencies(packageJson);
      expect(result).toContain('react');
    });
  });
});
