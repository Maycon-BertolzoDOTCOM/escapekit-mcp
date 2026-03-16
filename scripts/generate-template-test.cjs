const fs = require('fs');
const path = require('path');

const detectorPath = 'src/generators/TemplateEngine.ts';
const outputPath = 'tests/generated/TemplateEngine.test.ts';

console.log('Generating test for:', detectorPath);

const testCode = `import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '../../${detectorPath}';

describe('TemplateEngine', () => {
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
      const result = engine.render('Hello, {{missing}}!', {});
      expect(result).toBe('Hello, !');
    });
  });

  describe('built-in helpers', () => {
    it('should use camelCase helper', () => {
      const engine = new TemplateEngine();
      const result = engine.render('{{camelCase "hello world"}}', {});
      expect(result).toBe('helloWorld');
    });

    it('should use kebabCase helper', () => {
      const engine = new TemplateEngine();
      const result = engine.render('{{kebabCase "HelloWorld"}}', {});
      expect(result).toBe('hello-world');
    });

    it('should use upperCase helper', () => {
      const engine = new TemplateEngine();
      const result = engine.render('{{upperCase "hello"}}', {});
      expect(result).toBe('HELLO');
    });

    it('should use json helper', () => {
      const engine = new TemplateEngine();
      const result = engine.render('{{json obj}}', { obj: { name: 'John' } });
      expect(result).toBe('{\\n  "name": "John"\\n}');
    });
  });

  describe('compileTemplate', () => {
    it('should compile template', () => {
      const engine = new TemplateEngine();
      const compiled = engine.compileTemplate('Hello, {{name}}!');
      const result = compiled({ name: 'World' });
      expect(result).toBe('Hello, World!');
    });
  });
});
`;

const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, testCode, 'utf-8');
console.log('Test saved to:', outputPath);
console.log('Done!');
