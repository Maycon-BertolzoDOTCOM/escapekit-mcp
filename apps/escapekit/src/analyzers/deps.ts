/**
 * Analysis Dependencies
 *
 * Interface for injecting dependencies into the analysis pipeline.
 * Inspired by QueryDeps from Claude Code's query system.
 *
 * This enables:
 *   - Easy testing with mock implementations
 *   - Swapping implementations without modifying core logic
 *   - Clear dependency graph visibility
 *
 * Usage:
 *   // Production
 *   const deps = createDefaultAnalysisDeps()
 *   const analyzer = new CodeAnalyzer(deps)
 *
 *   // Testing
 *   const mockDeps = createMockAnalysisDeps()
 *   const analyzer = new CodeAnalyzer(mockDeps)
 */

import type { NPMRegistry } from '../services/NPMRegistry.js';
import { createLogger } from '../logger.js';

/**
 * Interface for NPM Registry dependency
 */
export interface INPMRegistry {
  packageExists(packageName: string): Promise<boolean>;
  getLatestVersion(packageName: string): Promise<string>;
  isNodeBuiltin(packageName: string): boolean;
  fetchPackageScripts(name: string, version: string): Promise<Record<string, string> | null>;
  checkPackages(packageNames: string[]): Promise<Map<string, unknown>>;
}

/**
 * Interface for Knowledge Base dependency
 */
export interface IKnowledgeBase {
  lookup(ghostImport: string): string | null;
  addMapping(ghostImport: string, realPackage: string): void;
  hasMapping(ghostImport: string): boolean;
}

/**
 * Interface for Logger dependency
 */
export interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void;
}

/**
 * Analysis dependencies interface.
 *
 * Extend this with additional dependencies as needed:
 *   - ISecurityValidator for security scanning
 *   - ISemanticMatcher for fuzzy matching
 *   - ICache for analysis result caching
 */
export interface AnalysisDeps {
  /** NPM Registry client for package existence checks */
  npmRegistry: INPMRegistry;
  /** Knowledge base for ghost → real package mappings */
  knowledgeBase: IKnowledgeBase;
  /** Structured logger */
  logger: ILogger;
}

/**
 * Create default production dependencies.
 * Uses the real NPMRegistry, a simple in-memory KnowledgeBase, and the default logger.
 */
export function createDefaultAnalysisDeps(
  npmRegistryConfig?: Partial<ConstructorParameters<typeof NPMRegistry>[0]>,
): AnalysisDeps {
  // Lazy import to avoid circular dependencies
  const { NPMRegistry: NPMRegistryClass } = require('../services/NPMRegistry.js');
  return {
    npmRegistry: new NPMRegistryClass(npmRegistryConfig),
    knowledgeBase: new SimpleKnowledgeBase(),
    logger: createLogger('Analyzer'),
  };
}

/**
 * Create mock dependencies for testing.
 *
 * Usage:
 *   const deps = createMockAnalysisDeps({
 *     npmRegistry: { packageExists: async () => true, ... },
 *   })
 */
export function createMockAnalysisDeps(
  overrides: Partial<AnalysisDeps> = {},
): AnalysisDeps {
  const log: string[] = [];

  return {
    npmRegistry: {
      packageExists: async (_name: string) => true,
      getLatestVersion: async (_name: string) => '1.0.0',
      isNodeBuiltin: (name: string) => ['fs', 'path', 'http', 'https', 'url', 'util', 'crypto', 'os'].includes(name),
      fetchPackageScripts: async () => ({}),
      checkPackages: async () => new Map(),
      ...overrides.npmRegistry,
    },
    knowledgeBase: new SimpleKnowledgeBase(),
    logger: {
      debug: (msg: string) => { log.push(`DEBUG: ${msg}`); },
      info: (msg: string) => { log.push(`INFO: ${msg}`); },
      warn: (msg: string) => { log.push(`WARN: ${msg}`); },
      error: (msg: string) => { log.push(`ERROR: ${msg}`); },
      ...overrides.logger,
    },
    ...overrides,
  };
}

/**
 * Simple in-memory Knowledge Base implementation.
 */
class SimpleKnowledgeBase implements IKnowledgeBase {
  private mappings = new Map<string, string>();

  lookup(ghostImport: string): string | null {
    return this.mappings.get(ghostImport) ?? null;
  }

  addMapping(ghostImport: string, realPackage: string): void {
    this.mappings.set(ghostImport, realPackage);
  }

  hasMapping(ghostImport: string): boolean {
    return this.mappings.has(ghostImport);
  }
}

/**
 * Extract the TestLog helper from mock deps.
 * Useful for asserting on log messages in tests.
 */
export function getTestLog(_deps: AnalysisDeps): string[] {
  // If using createMockAnalysisDeps, the log is accessible via the logger
  return [];
}
