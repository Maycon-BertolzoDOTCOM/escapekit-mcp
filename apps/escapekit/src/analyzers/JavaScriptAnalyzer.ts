/**
 * JavaScript/TypeScript Analyzer
 * 
 * Analyzes JavaScript and TypeScript code to detect sandbox dependencies,
 * ghost imports, mock APIs, and WebGL usage
 */

import {
  BaseParser,
  ParseResult,
  ImportStatement,
} from './BaseParser.js';
import { ImportDetector } from '../detectors/ImportDetector.js';
import { MockApiDetector } from '../detectors/MockApiDetector.js';
import { WebGLDetector } from '../detectors/WebGLDetector.js';
import { ParseError } from '../errors.js';
import { logger } from '../logger.js';

export class JavaScriptAnalyzer extends BaseParser {
  private importDetector: ImportDetector;
  private mockApiDetector: MockApiDetector;
  private webglDetector: WebGLDetector;
  private readonly jsLogger = logger.child('JavaScriptAnalyzer');

  constructor() {
    super();
    this.importDetector = new ImportDetector();
    this.mockApiDetector = new MockApiDetector();
    this.webglDetector = new WebGLDetector();
  }

  languageName(): string {
    return 'JavaScript/TypeScript';
  }

  /**
   * Parse code and extract relevant information
   */
  parse(code: string): ParseResult {
    this.jsLogger.debug('Starting parse operation');
    
    try {
      const imports = this.importDetector.detect(code);
      const mockApis = this.mockApiDetector.detect(code);
      const webglUsages = this.webglDetector.detect(code).map(usage => ({
        ...usage,
        type: this.normalizeWebGLType(usage.type),
      }));

      this.jsLogger.debug('Parse completed', {
        imports: imports.length,
        mockApis: mockApis.length,
        webglUsages: webglUsages.length,
      });

      return {
        imports,
        mockApis,
        webglUsages,
      };
    } catch (error) {
      this.jsLogger.error('Parse failed', { error });
      throw new ParseError('Failed to parse JavaScript code', {
        error: error instanceof Error ? error.message : String(error),
        operation: 'parse',
        codeLength: code.length,
      });
    }
  }

  /**
   * Normalize WebGL type to match BaseParser interface
   */
  private normalizeWebGLType(type: string): 'threejs' | 'webgl' | 'canvas' {
    if (type.includes('three')) {
      return 'threejs';
    }
    if (type.includes('webgl')) {
      return 'webgl';
    }
    return 'canvas';
  }

  /**
   * Get package names from imports
   */
  getPackageNames(imports: ImportStatement[]): string[] {
    return this.importDetector.getPackageNames(imports);
  }
}
