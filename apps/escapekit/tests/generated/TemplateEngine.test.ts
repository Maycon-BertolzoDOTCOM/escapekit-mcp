import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '../../src/generators/TemplateEngine';

describe('TemplateEngine', () => {
  describe('constructor', () => {
    it('should create engine with built-in helpers', () => {
      const engine = new TemplateEngine();
      expect(engine).toBeDefined();
    });
  });

  describe('render', () => {
    it('should render simple variable', () => {
      const engine = new TemplateEngine();
      const result = engine.render('Hello, {{name}}!', { name: 'World' });
      expect(result).toBe('Hello, World!');
    });

    it('should render nested property', () => {
      const engine = new TemplateEngine();
      const result = engine.render('{{user.name}}', { user: { name: 'John' } });
      expect(result).toBe('John');
    });

    it('should handle missing variable', () => {
      const engine = new TemplateEngine();
      const result = engine.render('Hello, {{name}}!', {});
      expect(result).toBe('Hello, !');
    });

    it('should render empty template', () => {
      const engine = new TemplateEngine();
      const result = engine.render('', {});
      expect(result).toBe('');
    });
  });
});
