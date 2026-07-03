/**
 * Base Parser Abstract Class
 * 
 * Abstract base class for all language-specific parsers
 */

export interface ParseResult {
  imports: ImportStatement[];
  mockApis: MockApiCall[];
  webglUsages: WebGLUsage[];
}

export interface ImportStatement {
  type: 'es6' | 'commonjs';
  source: string;
  specifiers?: string[];
  line: number;
  column: number;
  isRelative: boolean;
}

export interface MockApiCall {
  function: string;
  endpoint?: string;
  line: number;
  column: number;
}

export interface WebGLUsage {
  type: 'threejs' | 'webgl' | 'canvas';
  line: number;
  column: number;
}

export abstract class BaseParser {
  abstract parse(code: string): ParseResult;
  abstract languageName(): string;

  /**
   * Check if import source is relative (local file)
   */
  protected isRelativeImport(source: string): boolean {
    return source.startsWith('./') || source.startsWith('../') || source.startsWith('/');
  }

  /**
   * Extract package name from import source
   */
  protected extractPackageName(source: string): string {
    // Handle scoped packages (@scope/name)
    if (source.startsWith('@')) {
      const parts = source.split('/');
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
      }
      return source;
    }
    
    // Handle regular packages
    const parts = source.split('/');
    return parts[0];
  }
}