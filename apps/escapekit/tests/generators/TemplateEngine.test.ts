/**
 * Unit tests for TemplateEngine
 *
 * Tests cover:
 * - Variable interpolation
 * - Conditional blocks ({{#if}}, {{#unless}})
 * - Iteration blocks ({{#each}})
 * - Built-in helpers (camelCase, kebabCase, upperCase, json)
 * - Template compilation and caching
 * - File loading and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TemplateEngine } from '../../src/generators/TemplateEngine.js';
import { FileSystemError } from '../../src/errors.js';

describe('TemplateEngine', () => {
  let engine: TemplateEngine;

  beforeEach(() => {
    engine = new TemplateEngine();
  });

  // ─── Variable interpolation ────────────────────────────────────────────────

  describe('render() - variable interpolation', () => {
    it('replaces a simple variable', () => {
      expect(engine.render('Hello, {{name}}!', { name: 'World' })).toBe('Hello, World!');
    });

    it('replaces multiple variables', () => {
      const result = engine.render('{{first}} {{last}}', { first: 'John', last: 'Doe' });
      expect(result).toBe('John Doe');
    });

    it('resolves nested dot-notation paths', () => {
      const result = engine.render('{{user.name}}', { user: { name: 'Alice' } });
      expect(result).toBe('Alice');
    });

    it('returns empty string for undefined variables', () => {
      expect(engine.render('{{missing}}', {})).toBe('');
    });

    it('returns empty string for null variables', () => {
      expect(engine.render('{{val}}', { val: null })).toBe('');
    });

    it('renders numeric values', () => {
      expect(engine.render('Port: {{port}}', { port: 3000 })).toBe('Port: 3000');
    });

    it('renders boolean values', () => {
      expect(engine.render('{{flag}}', { flag: true })).toBe('true');
    });

    it('leaves non-template text unchanged', () => {
      expect(engine.render('plain text', {})).toBe('plain text');
    });
  });

  // ─── Conditional blocks ────────────────────────────────────────────────────

  describe('render() - {{#if}} blocks', () => {
    it('renders block when condition is true', () => {
      const result = engine.render('{{#if show}}visible{{/if}}', { show: true });
      expect(result).toBe('visible');
    });

    it('hides block when condition is false', () => {
      const result = engine.render('{{#if show}}visible{{/if}}', { show: false });
      expect(result).toBe('');
    });

    it('hides block when condition is undefined', () => {
      const result = engine.render('{{#if show}}visible{{/if}}', {});
      expect(result).toBe('');
    });

    it('hides block when condition is empty array', () => {
      const result = engine.render('{{#if items}}has items{{/if}}', { items: [] });
      expect(result).toBe('');
    });

    it('shows block when condition is non-empty array', () => {
      const result = engine.render('{{#if items}}has items{{/if}}', { items: [1] });
      expect(result).toBe('has items');
    });

    it('renders else branch when condition is false', () => {
      const result = engine.render('{{#if show}}yes{{else}}no{{/if}}', { show: false });
      expect(result).toBe('no');
    });

    it('renders if branch when condition is true (with else)', () => {
      const result = engine.render('{{#if show}}yes{{else}}no{{/if}}', { show: true });
      expect(result).toBe('yes');
    });

    it('evaluates nested dot-notation condition', () => {
      const result = engine.render('{{#if user.active}}active{{/if}}', {
        user: { active: true },
      });
      expect(result).toBe('active');
    });
  });

  describe('render() - {{#unless}} blocks', () => {
    it('renders block when condition is false', () => {
      const result = engine.render('{{#unless hidden}}visible{{/unless}}', { hidden: false });
      expect(result).toBe('visible');
    });

    it('hides block when condition is true', () => {
      const result = engine.render('{{#unless hidden}}visible{{/unless}}', { hidden: true });
      expect(result).toBe('');
    });

    it('renders block when condition is undefined', () => {
      const result = engine.render('{{#unless hidden}}visible{{/unless}}', {});
      expect(result).toBe('visible');
    });
  });

  // ─── Iteration blocks ──────────────────────────────────────────────────────

  describe('render() - {{#each}} blocks', () => {
    it('iterates over an array', () => {
      const result = engine.render('{{#each items}}{{this}} {{/each}}', {
        items: ['a', 'b', 'c'],
      });
      expect(result).toBe('a b c ');
    });

    it('provides @index for array items', () => {
      const result = engine.render('{{#each items}}{{@index}}:{{this}} {{/each}}', {
        items: ['x', 'y'],
      });
      expect(result).toBe('0:x 1:y ');
    });

    it('iterates over object properties', () => {
      const result = engine.render('{{#each obj}}{{@key}}={{this}} {{/each}}', {
        obj: { a: 1, b: 2 },
      });
      expect(result).toBe('a=1 b=2 ');
    });

    it('spreads object item properties into context', () => {
      const result = engine.render('{{#each users}}{{name}} {{/each}}', {
        users: [{ name: 'Alice' }, { name: 'Bob' }],
      });
      expect(result).toBe('Alice Bob ');
    });

    it('returns empty string for empty array', () => {
      const result = engine.render('{{#each items}}{{this}}{{/each}}', { items: [] });
      expect(result).toBe('');
    });

    it('returns empty string for null/undefined value', () => {
      const result = engine.render('{{#each items}}{{this}}{{/each}}', { items: null });
      expect(result).toBe('');
    });
  });

  // ─── Built-in helpers ──────────────────────────────────────────────────────

  describe('built-in helpers', () => {
    describe('camelCase', () => {
      it('converts kebab-case to camelCase', () => {
        expect(engine.render('{{camelCase name}}', { name: 'hello-world' })).toBe('helloWorld');
      });

      it('converts space-separated to camelCase', () => {
        expect(engine.render('{{camelCase name}}', { name: 'hello world' })).toBe('helloWorld');
      });

      it('converts snake_case to camelCase', () => {
        expect(engine.render('{{camelCase name}}', { name: 'hello_world' })).toBe('helloWorld');
      });

      it('lowercases the first character', () => {
        expect(engine.render('{{camelCase name}}', { name: 'Hello' })).toBe('hello');
      });
    });

    describe('kebabCase', () => {
      it('converts camelCase to kebab-case', () => {
        expect(engine.render('{{kebabCase name}}', { name: 'helloWorld' })).toBe('hello-world');
      });

      it('converts spaces to hyphens', () => {
        expect(engine.render('{{kebabCase name}}', { name: 'hello world' })).toBe('hello-world');
      });

      it('lowercases the result', () => {
        expect(engine.render('{{kebabCase name}}', { name: 'HELLO' })).toBe('hello');
      });
    });

    describe('upperCase', () => {
      it('converts camelCase to UPPER_CASE', () => {
        expect(engine.render('{{upperCase name}}', { name: 'helloWorld' })).toBe('HELLO_WORLD');
      });

      it('converts spaces to underscores and uppercases', () => {
        expect(engine.render('{{upperCase name}}', { name: 'hello world' })).toBe('HELLO_WORLD');
      });

      it('converts hyphens to underscores and uppercases', () => {
        expect(engine.render('{{upperCase name}}', { name: 'hello-world' })).toBe('HELLO_WORLD');
      });
    });

    describe('json', () => {
      it('serializes an object to JSON', () => {
        const result = engine.render('{{json data}}', { data: { key: 'value' } });
        expect(result).toBe('{\n  "key": "value"\n}');
      });

      it('serializes an array to JSON', () => {
        const result = engine.render('{{json items}}', { items: [1, 2, 3] });
        expect(result).toBe('[\n  1,\n  2,\n  3\n]');
      });

      it('serializes a string to JSON', () => {
        const result = engine.render('{{json val}}', { val: 'hello' });
        expect(result).toBe('"hello"');
      });
    });
  });

  // ─── Custom helpers ────────────────────────────────────────────────────────

  describe('addHelpers()', () => {
    it('registers and uses a custom helper', () => {
      engine.addHelpers({
        shout: (str: unknown) => String(str).toUpperCase() + '!!!',
      });
      expect(engine.render('{{shout msg}}', { msg: 'hello' })).toBe('HELLO!!!');
    });

    it('custom helper overrides built-in with same name', () => {
      engine.addHelpers({
        json: () => 'custom-json',
      });
      expect(engine.render('{{json data}}', { data: {} })).toBe('custom-json');
    });
  });

  // ─── Template compilation and caching ─────────────────────────────────────

  describe('compileTemplate()', () => {
    it('returns a function that renders the template', () => {
      const fn = engine.compileTemplate('Hello, {{name}}!');
      expect(fn({ name: 'Alice' })).toBe('Hello, Alice!');
      expect(fn({ name: 'Bob' })).toBe('Hello, Bob!');
    });

    it('returns the same function for the same template (cache hit)', () => {
      const template = 'Hello, {{name}}!';
      const fn1 = engine.compileTemplate(template);
      const fn2 = engine.compileTemplate(template);
      expect(fn1).toBe(fn2);
    });

    it('returns different functions for different templates', () => {
      const fn1 = engine.compileTemplate('{{a}}');
      const fn2 = engine.compileTemplate('{{b}}');
      expect(fn1).not.toBe(fn2);
    });

    it('clearCache() removes cached templates', () => {
      const template = 'Hello, {{name}}!';
      const fn1 = engine.compileTemplate(template);
      engine.clearCache();
      const fn2 = engine.compileTemplate(template);
      expect(fn1).not.toBe(fn2);
    });
  });

  // ─── File loading ──────────────────────────────────────────────────────────

  describe('loadTemplate()', () => {
    it('loads a template file successfully', async () => {
      // Use one of the actual template files we created
      const content = await engine.loadTemplate('templates/tsconfig.json.hbs');
      expect(content).toContain('{{target}}');
      expect(content).toContain('"strict": true');
    });

    it('throws FileSystemError when file does not exist', async () => {
      await expect(engine.loadTemplate('/nonexistent/path/template.hbs')).rejects.toThrow(
        FileSystemError
      );
    });

    it('FileSystemError has correct code', async () => {
      try {
        await engine.loadTemplate('/nonexistent/path/template.hbs');
      } catch (err) {
        expect(err).toBeInstanceOf(FileSystemError);
        expect((err as FileSystemError).code).toBe('FILE_SYSTEM_ERROR');
      }
    });
  });

  // ─── Integration: render real templates ───────────────────────────────────

  describe('render() - real template integration', () => {
    it('renders package.json.hbs template', async () => {
      const template = await engine.loadTemplate('templates/package.json.hbs');
      const result = engine.render(template, {
        projectName: 'my-app',
        version: '1.0.0',
        description: 'A test app',
        nodeVersion: '18.0.0',
        author: 'Test Author',
        license: 'MIT',
        dependencies: {},
      });
      expect(result).toContain('"name": "my-app"');
      expect(result).toContain('"version": "1.0.0"');
    });

    it('renders tsconfig.json.hbs template', async () => {
      const template = await engine.loadTemplate('templates/tsconfig.json.hbs');
      const result = engine.render(template, { target: 'ES2020' });
      expect(result).toContain('"target": "ES2020"');
      expect(result).toContain('"strict": true');
    });

    it('renders README.md.hbs template', async () => {
      const template = await engine.loadTemplate('templates/README.md.hbs');
      const result = engine.render(template, {
        projectName: 'My Project',
        description: 'A great project',
        nodeVersion: '18.0.0',
        targetPlatform: 'docker',
        includeDocker: true,
        license: 'MIT',
        dependencies: {},
      });
      expect(result).toContain('# My Project');
      expect(result).toContain('A great project');
      expect(result).toContain('Docker');
    });
  });
});
