/**
 * Transformation Engine Data Models
 * 
 * This module defines all data structures for the Phase 3 Transformation Engine.
 * These models form Camada 1 (Foundation layer) and have zero dependencies on other layers.
 * 
 * @module models/transformation
 */

/**
 * Strategies for mapping ghost imports to real packages.
 * 
 * @example
 * ```typescript
 * const mapping: PackageMapping = {
 *   ghostPackage: 'fake-api',
 *   realPackages: ['axios'],
 *   confidence: 0.95,
 *   mappingStrategy: MappingStrategy.EXACT_MATCH
 * };
 * ```
 */
export enum MappingStrategy {
  /** Direct 1:1 mapping from knowledge base */
  EXACT_MATCH = 'EXACT_MATCH',
  /** Fuzzy/semantic similarity matching */
  SEMANTIC_MATCH = 'SEMANTIC_MATCH',
  /** User-provided manual mapping */
  MANUAL_OVERRIDE = 'MANUAL_OVERRIDE',
  /** Default fallback option when no better match exists */
  FALLBACK = 'FALLBACK'
}

/**
 * Methods used to resolve dependencies.
 * 
 * @example
 * ```typescript
 * const resolution: DependencyResolution = {
 *   originalImport: 'fake-api',
 *   resolvedPackage: 'axios',
 *   version: '^1.6.0',
 *   resolutionMethod: ResolutionMethod.KNOWLEDGE_BASE,
 *   confidence: 0.95
 * };
 * ```
 */
export enum ResolutionMethod {
  /** Resolved from built-in knowledge base */
  KNOWLEDGE_BASE = 'KNOWLEDGE_BASE',
  /** Resolved from npm registry search */
  NPM_SEARCH = 'NPM_SEARCH',
  /** Resolved from semantic analysis */
  SEMANTIC_ANALYSIS = 'SEMANTIC_ANALYSIS',
  /** User-specified resolution */
  USER_PROVIDED = 'USER_PROVIDED'
}

/**
 * Types of transformations that can be applied to code.
 * 
 * @example
 * ```typescript
 * const rule: TransformationRule = {
 *   ruleId: 'import-replacement-001',
 *   ruleType: TransformationType.IMPORT_REPLACEMENT,
 *   sourcePattern: 'fake-api',
 *   targetPattern: 'axios'
 * };
 * ```
 */
export enum TransformationType {
  /** Replace import statement with real package */
  IMPORT_REPLACEMENT = 'IMPORT_REPLACEMENT',
  /** Add polyfill code for missing functionality */
  POLYFILL_INJECTION = 'POLYFILL_INJECTION',
  /** Migrate API calls to new interface */
  API_MIGRATION = 'API_MIGRATION',
  /** Generate configuration files */
  CONFIGURATION_GENERATION = 'CONFIGURATION_GENERATION'
}

/**
 * Mapping from a ghost package to one or more real packages.
 * 
 * @example
 * ```typescript
 * const mapping: PackageMapping = {
 *   ghostPackage: 'fake-api-client',
 *   realPackages: ['axios', 'node-fetch'],
 *   confidence: 0.95,
 *   mappingStrategy: MappingStrategy.KNOWLEDGE_BASE,
 *   metadata: {
 *     reason: 'Common HTTP client replacement',
 *     alternatives: ['got', 'superagent'],
 *     source: 'knowledge-base.json'
 *   }
 * };
 * ```
 */
export interface PackageMapping {
  /** Original non-existent package name */
  ghostPackage: string;
  /** Alternative real packages (ranked by preference) */
  realPackages: string[];
  /** Confidence score between 0.0 and 1.0 */
  confidence: number;
  /** How this mapping was determined */
  mappingStrategy: MappingStrategy;
  /** Additional metadata about the mapping */
  metadata?: {
    /** Explanation of why this mapping was chosen */
    reason?: string;
    /** Other packages that were considered */
    alternatives?: string[];
    /** Source of the mapping (e.g., 'knowledge-base', 'npm-search') */
    source?: string;
  };
}

/**
 * Rule defining how to transform code.
 * 
 * @example
 * ```typescript
 * const rule: TransformationRule = {
 *   ruleId: 'import-replacement-001',
 *   ruleType: TransformationType.IMPORT_REPLACEMENT,
 *   sourcePattern: 'fake-api-client',
 *   targetPattern: 'axios',
 *   metadata: {
 *     description: 'Replace fake-api-client with axios',
 *     examples: [
 *       "import api from 'fake-api-client' → import api from 'axios'"
 *     ],
 *     tags: ['http', 'api', 'client']
 *   }
 * };
 * ```
 */
export interface TransformationRule {
  /** Unique identifier for this rule */
  ruleId: string;
  /** Type of transformation this rule performs */
  ruleType: TransformationType;
  /** Pattern to match (regex or literal string) */
  sourcePattern: string;
  /** Replacement pattern */
  targetPattern: string;
  /** Additional metadata about the rule */
  metadata?: {
    /** Human-readable description of what this rule does */
    description?: string;
    /** Example transformations */
    examples?: string[];
    /** Tags for categorization */
    tags?: string[];
  };
}

/**
 * Result of resolving a ghost import to a real package.
 * 
 * @example
 * ```typescript
 * const resolution: DependencyResolution = {
 *   originalImport: 'fake-api-client',
 *   resolvedPackage: 'axios',
 *   version: '^1.6.0',
 *   resolutionMethod: ResolutionMethod.KNOWLEDGE_BASE,
 *   confidence: 0.95,
 *   metadata: {
 *     alternatives: ['node-fetch', 'got'],
 *     reasoning: 'Most popular HTTP client with similar API',
 *     npmInfo: {
 *       downloads: 50000000,
 *       lastUpdate: '2024-01-15',
 *       deprecated: false
 *     }
 *   }
 * };
 * ```
 */
export interface DependencyResolution {
  /** Original ghost import that was resolved */
  originalImport: string;
  /** Resolved real package name */
  resolvedPackage: string;
  /** Package version (semantic versioning) */
  version: string;
  /** Method used to resolve this dependency */
  resolutionMethod: ResolutionMethod;
  /** Confidence score between 0.0 and 1.0 */
  confidence: number;
  /** Additional metadata about the resolution */
  metadata?: {
    /** Other packages that were considered */
    alternatives?: string[];
    /** Explanation of why this package was chosen */
    reasoning?: string;
    /** NPM registry metadata */
    npmInfo?: {
      /** Weekly download count */
      downloads?: number;
      /** Last update date (ISO 8601) */
      lastUpdate?: string;
      /** Whether the package is deprecated */
      deprecated?: boolean;
    };
    /** Validation status from NPM registry */
    validationStatus?: 'VERIFIED' | 'UNVERIFIED';
  };
}

/**
 * Result of transforming source code.
 * 
 * @example
 * ```typescript
 * const transformation: CodeTransformation = {
 *   transformationId: 'transform-1234567890-abc123',
 *   sourceCode: "import api from 'fake-api';",
 *   transformedCode: "import api from 'axios';",
 *   appliedRules: [
 *     {
 *       ruleId: 'import-replacement-001',
 *       ruleType: TransformationType.IMPORT_REPLACEMENT,
 *       sourcePattern: 'fake-api',
 *       targetPattern: 'axios'
 *     }
 *   ],
 *   timestamp: '2024-01-15T10:30:00Z',
 *   metadata: {
 *     diff: '@@ -1 +1 @@\n-import api from \'fake-api\';\n+import api from \'axios\';',
 *     stats: {
 *       linesChanged: 1,
 *       importsReplaced: 1,
 *       polyfillsAdded: 0
 *     }
 *   }
 * };
 * ```
 */
export interface CodeTransformation {
  /** Unique identifier for this transformation */
  transformationId: string;
  /** Original source code before transformation */
  sourceCode: string;
  /** Transformed source code */
  transformedCode: string;
  /** Rules that were applied during transformation */
  appliedRules: TransformationRule[];
  /** When the transformation occurred (ISO 8601) */
  timestamp: string;
  /** Additional metadata about the transformation */
  metadata?: {
    /** Unified diff showing changes */
    diff?: string;
    /** Statistics about the transformation */
    stats?: {
      /** Number of lines changed */
      linesChanged: number;
      /** Number of imports replaced */
      importsReplaced: number;
      /** Number of polyfills added */
      polyfillsAdded: number;
    };
  };
}

/**
 * Structure of a generated project.
 * 
 * @example
 * ```typescript
 * const structure: ProjectStructure = {
 *   rootPath: '/path/to/project',
 *   directories: ['src', 'tests', 'public', 'config'],
 *   files: new Map([
 *     ['src/index.ts', 'export default function() {}'],
 *     ['package.json', '{"name": "my-project"}']
 *   ]),
 *   dependencies: new Map([
 *     ['axios', '^1.6.0'],
 *     ['typescript', '^5.0.0']
 *   ]),
 *   configuration: {
 *     packageJson: {
 *       name: 'my-project',
 *       version: '1.0.0',
 *       dependencies: { axios: '^1.6.0' }
 *     },
 *     tsConfig: {
 *       compilerOptions: {
 *         target: 'ES2020',
 *         module: 'ESNext'
 *       }
 *     }
 *   }
 * };
 * ```
 */
export interface ProjectStructure {
  /** Root directory path of the project */
  rootPath: string;
  /** List of created directories */
  directories: string[];
  /** Map of file paths to their content */
  files: Map<string, string>;
  /** Map of package names to versions */
  dependencies: Map<string, string>;
  /** Project configuration objects */
  configuration: {
    /** Parsed package.json content */
    packageJson: Record<string, unknown>;
    /** Parsed tsconfig.json content (if TypeScript project) */
    tsConfig?: Record<string, unknown>;
    /** Parsed ESLint configuration (if present) */
    eslintConfig?: Record<string, unknown>;
  };
}

/**
 * Escape contract documenting all transformations applied to sandbox code.
 * 
 * This contract provides a complete audit trail of the transformation process,
 * including what was changed, why it was changed, and any assumptions made.
 * 
 * @example
 * ```typescript
 * const contract: EscapeContract = {
 *   contractId: 'contract-1234567890-abc123',
 *   analysisId: 'analysis-1234567890-xyz789',
 *   origin: {
 *     sandboxType: 'claude-artifacts',
 *     originalCodeHash: 'sha256:abc123...',
 *     detectedIssues: 5
 *   },
 *   transformations: {
 *     ghostImportResolutions: [
 *       {
 *         originalImport: 'fake-api',
 *         resolvedPackage: 'axios',
 *         version: '^1.6.0',
 *         resolutionMethod: ResolutionMethod.KNOWLEDGE_BASE,
 *         confidence: 0.95
 *       }
 *     ],
 *     codeTransformations: [
 *       {
 *         transformationId: 'transform-1234567890-def456',
 *         sourceCode: "import api from 'fake-api';",
 *         transformedCode: "import api from 'axios';",
 *         appliedRules: [],
 *         timestamp: '2024-01-15T10:30:00Z'
 *       }
 *     ],
 *     appliedRules: []
 *   },
 *   assumptions: [
 *     'Assumed axios is suitable replacement for fake-api-client',
 *     'Manual review required for API endpoint configuration'
 *   ],
 *   validationStatus: 'PENDING',
 *   metadata: {
 *     generatedBy: 'EscapeKit MCP',
 *     toolVersion: '1.0.0',
 *     targetPlatform: 'vercel',
 *     timestamp: '2024-01-15T10:30:00Z'
 *   }
 * };
 * ```
 */
export interface EscapeContract {
  /** Unique identifier for this contract */
  contractId: string;
  /** Reference to the analysis that triggered this transformation */
  analysisId: string;
  /** Information about the source code origin */
  origin: {
    /** Type of sandbox (e.g., 'claude-artifacts', 'replit', 'codesandbox') */
    sandboxType?: string;
    /** SHA-256 hash of the original code */
    originalCodeHash: string;
    /** Number of issues detected in the analysis */
    detectedIssues: number;
  };
  /** All transformations that were applied */
  transformations: {
    /** Ghost import resolutions */
    ghostImportResolutions: DependencyResolution[];
    /** Code transformations */
    codeTransformations: CodeTransformation[];
    /** Transformation rules that were applied */
    appliedRules: TransformationRule[];
  };
  /** Assumptions made during transformation (manual interventions, unresolved issues) */
  assumptions: string[];
  /** Current validation status of the generated project */
  validationStatus: 'PENDING' | 'PASSED' | 'FAILED';
  /** Metadata about the transformation process */
  metadata: {
    /** Name of the tool that generated this contract */
    generatedBy: string;
    /** Version of the tool */
    toolVersion: string;
    /** Target deployment platform */
    targetPlatform: string;
    /** When the contract was generated (ISO 8601) */
    timestamp: string;
  };
}
