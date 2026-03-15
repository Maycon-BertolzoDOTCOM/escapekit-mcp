/**
 * Import Detector
 * 
 * Detects and extracts import statements from code
 */

import { logger } from '../logger.js';

export type ImportType = 'es6' | 'commonjs';

export interface ImportStatement {
  /** Type of import statement */
  type: ImportType;
  /** The import source (package name or file path) */
  source: string;
  /** Line number where import was found */
  line: number;
  /** Column number where import was found */
  column: number;
  /** Whether this is a relative import */
  isRelative: boolean;
}

export interface ImportPattern {
  /** Regular expression pattern to match */
  pattern: RegExp;
  /** Type of import */
  type: ImportType;
}

/**
 * Default import patterns for ES6 and CommonJS
 */
const DEFAULT_IMPORT_PATTERNS: ImportPattern[] = [
  {
    pattern: /import\s+(?:(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]|['"]([^'"]+)['"])/g,
    type: 'es6',
  },
  {
    pattern: /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    type: 'commonjs',
  },
];

export class ImportDetector {
  private patterns: ImportPattern[];
  private readonly logger = logger.child('ImportDetector');

  constructor(patterns: ImportPattern[] = DEFAULT_IMPORT_PATTERNS) {
    this.patterns = [...patterns];
    this.logger.debug(`Initialized with ${patterns.length} patterns`);
  }

  /**
   * Detect all import statements in code
   */
  detect(code: string): ImportStatement[] {
    const imports: ImportStatement[] = [];

    for (const { pattern, type } of this.patterns) {
      let match;
      const regex = new RegExp(pattern, 'g');
      
      while ((match = regex.exec(code)) !== null) {
        // For ES6 imports, the source might be in match[1] or match[2]
        // For CommonJS requires, it's in match[1]
        const source = match[1] || match[2];
        
        if (!source) continue;

        const position = this.findPosition(code, match.index);
        
        imports.push({
          type,
          source,
          line: position.line,
          column: position.column,
          isRelative: this.isRelativeImport(source),
        });
      }
    }

    if (imports.length > 0) {
      this.logger.debug(`Detected ${imports.length} import statements`);
    }

    return imports;
  }

  /**
   * Extract unique package names from imports (excluding relative imports)
   */
  getPackageNames(imports: ImportStatement[]): string[] {
    const packages = imports
      .filter(imp => !imp.isRelative)
      .map(imp => this.extractPackageName(imp.source));

    // Return unique package names
    return Array.from(new Set(packages));
  }

  /**
   * Get imports by type
   */
  getImportsByType(imports: ImportStatement[], type: ImportType): ImportStatement[] {
    return imports.filter(imp => imp.type === type);
  }

  /**
   * Get relative imports
   */
  getRelativeImports(imports: ImportStatement[]): ImportStatement[] {
    return imports.filter(imp => imp.isRelative);
  }

  /**
   * Get absolute/external imports
   */
  getExternalImports(imports: ImportStatement[]): ImportStatement[] {
    return imports.filter(imp => !imp.isRelative);
  }

  /**
   * Check if a source is a relative import
   */
  isRelativeImport(source: string): boolean {
    return source.startsWith('./') || source.startsWith('../') || source.startsWith('/');
  }

  /**
   * Extract package name from import source
   */
  extractPackageName(source: string): string {
    // Remove @scope if present
    if (source.startsWith('@')) {
      const parts = source.split('/');
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
      }
      return source;
    }
    
    // For non-scoped packages, take the first part before '/'
    const parts = source.split('/');
    return parts[0];
  }

  /**
   * Add a custom import pattern
   */
  addPattern(pattern: ImportPattern): void {
    this.patterns.push(pattern);
    this.logger.debug(`Added pattern for: ${pattern.type}`);
  }

  /**
   * Remove all patterns
   */
  clearPatterns(): void {
    this.patterns.length = 0;
    this.logger.debug('Cleared all patterns');
  }

  /**
   * Get all current patterns
   */
  getPatterns(): ImportPattern[] {
    return [...this.patterns];
  }

  /**
   * Convert character index to line and column
   */
  private findPosition(code: string, index: number): { line: number; column: number } {
    let line = 0;
    let column = 0;

    for (let i = 0; i < index && i < code.length; i++) {
      if (code[i] === '\n') {
        line++;
        column = 0;
      } else {
        column++;
      }
    }

    return { line: line + 1, column: column + 1 };
  }

  /**
   * Get import statistics
   */
  getStatistics(imports: ImportStatement[]): {
    total: number;
    es6: number;
    commonjs: number;
    relative: number;
    external: number;
    packages: number;
  } {
    return {
      total: imports.length,
      es6: imports.filter(i => i.type === 'es6').length,
      commonjs: imports.filter(i => i.type === 'commonjs').length,
      relative: imports.filter(i => i.isRelative).length,
      external: imports.filter(i => !i.isRelative).length,
      packages: this.getPackageNames(imports).length,
    };
  }
}

/**
 * Create a default ImportDetector instance
 */
export function createImportDetector(): ImportDetector {
  return new ImportDetector();
}