/**
 * TemplateEngine - Lightweight template rendering engine
 *
 * Implements Handlebars-compatible template syntax using built-in string
 * processing. No external dependencies required.
 *
 * Supports:
 * - Variable interpolation: {{variable}}, {{nested.property}}
 * - Conditional blocks: {{#if condition}}...{{/if}}, {{#unless condition}}...{{/unless}}
 * - Iteration blocks: {{#each array}}...{{/each}} (with {{this}}, {{@index}}, {{@key}})
 * - Custom helpers: {{helperName arg}}
 * - Built-in helpers: camelCase, kebabCase, upperCase, json
 */

import { readFile } from 'fs/promises';
import { FileSystemError } from '../errors.js';

/** A compiled template function */
export type CompiledTemplate = (context: Record<string, unknown>) => string;

/** Helper function signature */
export type HelperFunction = (...args: unknown[]) => string;

/**
 * Lightweight template engine with Handlebars-compatible syntax.
 *
 * @example
 * ```typescript
 * const engine = new TemplateEngine();
 * const result = engine.render('Hello, {{name}}!', { name: 'World' });
 * // => 'Hello, World!'
 * ```
 */
export class TemplateEngine {
  private helpers: Map<string, HelperFunction> = new Map();
  private cache: Map<string, CompiledTemplate> = new Map();

  constructor() {
    this.registerHelpers();
  }

  /**
   * Register built-in and custom Handlebars helpers.
   * Built-ins: camelCase, kebabCase, upperCase, json
   */
  registerHelpers(): void {
    // camelCase: converts "hello world" or "hello-world" to "helloWorld"
    this.helpers.set('camelCase', (str: unknown): string => {
      const s = String(str ?? '');
      return s
        .replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
        .replace(/^(.)/, (c: string) => c.toLowerCase());
    });

    // kebabCase: converts "Hello World" or "helloWorld" to "hello-world"
    this.helpers.set('kebabCase', (str: unknown): string => {
      const s = String(str ?? '');
      return s
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
    });

    // upperCase: converts to UPPER_CASE
    this.helpers.set('upperCase', (str: unknown): string => {
      const s = String(str ?? '');
      return s
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toUpperCase();
    });

    // json: JSON.stringify with 2-space indent
    this.helpers.set('json', (obj: unknown): string => {
      try {
        return JSON.stringify(obj, null, 2);
      } catch {
        return String(obj);
      }
    });
  }

  /**
   * Register additional custom helpers.
   *
   * @param helpers - Map of helper name to function
   */
  addHelpers(helpers: Record<string, HelperFunction>): void {
    for (const [name, fn] of Object.entries(helpers)) {
      this.helpers.set(name, fn);
    }
  }

  /**
   * Render a template string with the given context.
   *
   * @param template - Template string with {{...}} expressions
   * @param context - Data context for variable resolution
   * @returns Rendered string
   *
   * @example
   * ```typescript
   * engine.render('{{#if show}}visible{{/if}}', { show: true });
   * // => 'visible'
   * ```
   */
  render(template: string, context: Record<string, unknown>): string {
    let result = template;

    // Process blocks (if/unless/each) before simple variables
    result = this.processBlocks(result, context);

    // Process simple variable interpolation and helpers
    result = this.processVariables(result, context);

    return result;
  }

  /**
   * Load a template from a file path.
   *
   * @param path - Absolute or relative path to the template file
   * @returns Template string content
   * @throws FileSystemError if the file cannot be read
   */
  async loadTemplate(path: string): Promise<string> {
    try {
      return await readFile(path, 'utf-8');
    } catch (err) {
      throw new FileSystemError(
        `Failed to load template from "${path}": ${(err as Error).message}`,
        'readFile',
        { path }
      );
    }
  }

  /**
   * Compile a template string into a reusable function with caching.
   *
   * @param template - Template string to compile
   * @returns Compiled template function
   *
   * @example
   * ```typescript
   * const fn = engine.compileTemplate('Hello, {{name}}!');
   * fn({ name: 'Alice' }); // => 'Hello, Alice!'
   * fn({ name: 'Bob' });   // => 'Hello, Bob!'
   * ```
   */
  compileTemplate(template: string): CompiledTemplate {
    if (this.cache.has(template)) {
      return this.cache.get(template)!;
    }

    const compiled: CompiledTemplate = (context: Record<string, unknown>) =>
      this.render(template, context);

    this.cache.set(template, compiled);
    return compiled;
  }

  /**
   * Clear the compiled template cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Process block-level constructs: {{#if}}, {{#unless}}, {{#each}}.
   * Handles nesting by processing innermost blocks first.
   */
  private processBlocks(template: string, context: Record<string, unknown>): string {
    let result = template;
    let changed = true;

    // Iterate until no more block changes (handles nesting)
    while (changed) {
      const before = result;
      result = this.processEachBlocks(result, context);
      result = this.processIfBlocks(result, context);
      result = this.processUnlessBlocks(result, context);
      changed = result !== before;
    }

    return result;
  }

  /**
   * Process {{#each array}}...{{/each}} blocks.
   * Inside the block, {{this}} refers to the current item,
   * {{@index}} to the numeric index, {{@key}} to the key (for objects).
   */
  private processEachBlocks(template: string, context: Record<string, unknown>): string {
    // Match innermost {{#each ...}}...{{/each}} (no nested each inside)
    const eachRegex = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

    return template.replace(eachRegex, (_match, expr: string, body: string) => {
      const value = this.resolveValue(expr.trim(), context);

      if (!value) return '';

      if (Array.isArray(value)) {
        return value
          .map((item, index) => {
            const itemContext: Record<string, unknown> = {
              ...context,
              this: item,
              '@index': index,
              '@key': index,
            };
            // If item is an object, spread its properties into context
            if (item && typeof item === 'object' && !Array.isArray(item)) {
              Object.assign(itemContext, item as Record<string, unknown>);
            }
            return this.render(body, itemContext);
          })
          .join('');
      }

      if (typeof value === 'object' && value !== null) {
        return Object.entries(value as Record<string, unknown>)
          .map(([key, item]) => {
            const itemContext: Record<string, unknown> = {
              ...context,
              this: item,
              '@key': key,
              '@index': key,
            };
            if (item && typeof item === 'object' && !Array.isArray(item)) {
              Object.assign(itemContext, item as Record<string, unknown>);
            }
            return this.render(body, itemContext);
          })
          .join('');
      }

      return '';
    });
  }

  /**
   * Process {{#if condition}}...{{else}}...{{/if}} blocks.
   */
  private processIfBlocks(template: string, context: Record<string, unknown>): string {
    // Match innermost {{#if ...}}...{{/if}} (no nested if inside)
    const ifRegex = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

    return template.replace(ifRegex, (_match, expr: string, body: string) => {
      const value = this.resolveValue(expr.trim(), context);
      const isTruthy = this.isTruthy(value);

      // Handle {{else}} inside the block
      const elseIndex = body.indexOf('{{else}}');
      if (elseIndex !== -1) {
        const truePart = body.slice(0, elseIndex);
        const falsePart = body.slice(elseIndex + '{{else}}'.length);
        return isTruthy ? this.render(truePart, context) : this.render(falsePart, context);
      }

      return isTruthy ? this.render(body, context) : '';
    });
  }

  /**
   * Process {{#unless condition}}...{{/unless}} blocks.
   */
  private processUnlessBlocks(template: string, context: Record<string, unknown>): string {
    const unlessRegex = /\{\{#unless\s+([^}]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g;

    return template.replace(unlessRegex, (_match, expr: string, body: string) => {
      const value = this.resolveValue(expr.trim(), context);
      const isFalsy = !this.isTruthy(value);
      return isFalsy ? this.render(body, context) : '';
    });
  }

  /**
   * Process {{variable}} and {{helper arg}} expressions.
   */
  private processVariables(template: string, context: Record<string, unknown>): string {
    // Match {{expression}} - not block tags (those start with # or /)
    const varRegex = /\{\{(?!#|\/|else)([^}]+)\}\}/g;

    return template.replace(varRegex, (_match, expr: string) => {
      const trimmed = expr.trim();

      // Check if it's a helper call: "helperName arg"
      const spaceIdx = trimmed.indexOf(' ');
      if (spaceIdx !== -1) {
        const helperName = trimmed.slice(0, spaceIdx);
        const argExpr = trimmed.slice(spaceIdx + 1).trim();

        if (this.helpers.has(helperName)) {
          const argValue = this.resolveValue(argExpr, context);
          const helperFn = this.helpers.get(helperName)!;
          return helperFn(argValue);
        }
      }

      // Plain variable or nested path
      const value = this.resolveValue(trimmed, context);
      if (value === undefined || value === null) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    });
  }

  /**
   * Resolve a dot-notation path against the context.
   * e.g. "user.name" resolves context.user.name
   */
  private resolveValue(expr: string, context: Record<string, unknown>): unknown {
    if (expr === 'this') return context['this'] ?? context;

    const parts = expr.split('.');
    let current: unknown = context;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Determine truthiness for template conditionals.
   * Falsy: false, null, undefined, 0, '', [], {}
   */
  private isTruthy(value: unknown): boolean {
    if (value === null || value === undefined || value === false || value === 0 || value === '') {
      return false;
    }
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value as object).length > 0;
    return true;
  }
}
