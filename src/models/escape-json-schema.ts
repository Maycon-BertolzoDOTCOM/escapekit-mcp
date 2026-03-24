/**
 * escape.json Protocol Schema v1.0
 * 
 * This file defines the TypeScript interface for the escape.json protocol,
 * which serves as the "digital birth certificate" for projects analyzed by EscapeKit.
 * 
 * Purpose: Provide complete traceability from source to production deployment
 * - Provenance: Where the code came from
 * - Transformations: What was changed and why
 * - Validations: Quality checks and results
 * - Deployment: Where the code is running
 * - Sovereignty: Chinese self-reliance compliance
 * 
 * @see https://github.com/escapekit/escapekit-mcp/docs/escape-json-protocol.md
 */

/**
 * Main structure of escape.json
 */
export interface EscapeJson {
  $schema: string;
  version: string;
  escapeId: string;
  timestamp: string;
  provenance: Provenance;
  analysis: AnalysisInfo;
  transformations: Transformations;
  validations: Validations;
  deployment: DeploymentInfo;
  sovereignty: SovereigntyInfo;
  metadata: Metadata;
}

/**
 * Source provenance information
 */
export interface Provenance {
  /**
   * Source sandbox type (ai-studio, bolt.new, replit, etc.)
   */
  sandbox: string;
  
  /**
   * Source URL (if available)
   */
  sourceUrl?: string;
  
  /**
   * Original hash of source code (SHA-256)
   */
  sourceHash: string;
  
  /**
   * List of original files with hashes
   */
  files: FileRecord[];
  
  /**
   * Detection timestamp
   */
  detectedAt: string;
}

/**
 * Individual file record
 */
export interface FileRecord {
  /**
   * File path relative to project root
   */
  path: string;
  
  /**
   * SHA-256 hash of file contents
   */
  hash: string;
  
  /**
   * File size in bytes
   */
  size: number;
  
  /**
   * File type (source, config, asset, etc.)
   */
  type: 'source' | 'config' | 'asset' | 'test' | 'doc';
  
  /**
   * Language (for source files)
   */
  language?: string;
}

/**
 * Analysis information
 */
export interface AnalysisInfo {
  /**
   * Analysis ID (same as escapeId)
   */
  analysisId: string;
  
  /**
   * Analysis timestamp
   */
  analysisAt: string;
  
  /**
   * EscapeKit version used for analysis
   */
  escapeKitVersion: string;
  
  /**
   * Configuration used
   */
  config: AnalysisConfig;
  
  /**
   * Issues detected
   */
  issues: DetectedIssue[];
  
  /**
   * Confidence score (0-1)
   */
  confidenceScore: number;
  
  /**
   * Total issues count
   */
  totalIssues: number;
  
  /**
   * Issues breakdown
   */
  issueBreakdown: IssueBreakdown;
}

/**
 * Analysis configuration
 */
export interface AnalysisConfig {
  /**
   * Target platform
   */
  targetPlatform: string;
  
  /**
   * Target runtime
   */
  targetRuntime: string;
  
  /**
   * Strictness level
   */
  strictness: 'basic' | 'standard' | 'strict';
  
  /**
   * Whether to use Chinese mirrors
   */
  useChineseMirrors: boolean;
}

/**
 * Detected issue
 */
export interface DetectedIssue {
  /**
   * Issue type
   */
  type: IssueType;
  
  /**
   * Severity level
   */
  severity: 'error' | 'warning' | 'info';
  
  /**
   * File path where issue was found
   */
  filePath: string;
  
  /**
   * Line number (0-indexed)
   */
  line: number;
  
  /**
   * Column number (0-indexed)
   */
  column?: number;
  
  /**
   * Issue description
   */
  message: string;
  
  /**
   * Suggested fix
   */
  suggestion?: string;
  
  /**
   * Package name (for import-related issues)
   */
  packageName?: string;
  
  /**
   * Whether issue was fixed
   */
  fixed: boolean;
  
  /**
   * How the issue was fixed
   */
  fixMethod?: FixMethod;

  /**
   * Name of the detector that produced this issue, e.g. "SlopsquatDetector"
   */
  detector?: string;

  /**
   * Optional academic paper reference that underpins this issue's detection rule
   */
  academicReference?: import('./academic.js').AcademicReference;
}

/**
 * Issue types
 */
export type IssueType =
  | 'GHOST_IMPORT'
  | 'MOCK_API'
  | 'SANDBOX_API'
  | 'UNREALISTIC_ASSUMPTION'
  | 'SECURITY_RISK'
  | 'PERFORMANCE_ISSUE'
  | 'CODE_QUALITY'
  | 'MISSING_DEPENDENCY'
  | 'VERSION_MISMATCH'
  | 'WEBGL_FALLBACK_NEEDED';

/**
 * Fix methods
 */
export type FixMethod =
  | 'REPLACED_WITH_REAL_PACKAGE'
  | 'REPLACED_WITH_POLYFILL'
  | 'REMOVED'
  | 'COMMENTED_OUT'
  | 'UPDATED_TO_COMPATIBLE_VERSION'
  | 'ADDED_FALLBACK'
  | 'CUSTOM_IMPLEMENTATION';

/**
 * Issue breakdown statistics
 */
export interface IssueBreakdown {
  ghostImports: number;
  mockApis: number;
  sandboxApis: number;
  unrealisticAssumptions: number;
  securityRisks: number;
  performanceIssues: number;
  codeQuality: number;
  missingDependencies: number;
  versionMismatches: number;
  webglFallbacksNeeded: number;
}

/**
 * Transformations applied
 */
export interface Transformations {
  /**
   * Transformations timestamp
   */
  transformedAt: string;
  
  /**
   * Transformations applied
   */
  applied: AppliedTransformation[];
  
  /**
   * Total transformations count
   */
  totalTransformations: number;
  
  /**
   * Transformation breakdown
   */
  breakdown: TransformationBreakdown;
}

/**
 * Individual transformation
 */
export interface AppliedTransformation {
  /**
   * Transformation type
   */
  type: TransformationType;
  
  /**
   * Target file
   */
  filePath: string;
  
  /**
   * Original code (snippet)
   */
  originalCode?: string;
  
  /**
   * Transformed code (snippet)
   */
  transformedCode?: string;
  
  /**
   * Reason for transformation
   */
  reason: string;
  
  /**
   * Package or resource used
   */
  packageUsed?: string;
  
  /**
   * Transformation timestamp
   */
  timestamp: string;
}

/**
 * Transformation types
 */
export type TransformationType =
  | 'IMPORT_REPLACEMENT'
  | 'API_REPLACEMENT'
  | 'POLYFILL_ADDITION'
  | 'FALLBACK_IMPLEMENTATION'
  | 'VERSION_UPDATE'
  | 'DEPENDENCY_ADDITION'
  | 'CONFIG_GENERATION'
  | 'CODE_REFACTORING';

/**
 * Transformation breakdown statistics
 */
export interface TransformationBreakdown {
  importReplacements: number;
  apiReplacements: number;
  polyfillAdditions: number;
  fallbackImplementations: number;
  versionUpdates: number;
  dependencyAdditions: number;
  configGenerations: number;
  codeRefactorings: number;
}

/**
 * Validation information
 */
export interface Validations {
  /**
   * Validations performed
   */
  validations: ValidationRecord[];
  
  /**
   * Overall validation status
   */
  overallStatus: 'pending' | 'in_progress' | 'passed' | 'failed' | 'partial';
  
  /**
   * Total validation count
   */
  totalValidations: number;
  
  /**
   * Passed validations count
   */
  passedValidations: number;
  
  /**
   * Failed validations count
   */
  failedValidations: number;
  
  /**
   * Kiwi TCMS test run ID (if uploaded)
   */
  kiwiTestRunId?: number;
  
  /**
   * Test results summary
   */
  testResults?: TestResultsSummary;
}

/**
 * Individual validation record
 */
export interface ValidationRecord {
  /**
   * Validation type
   */
  type: ValidationType;
  
  /**
   * Validation timestamp
   */
  validatedAt: string;
  
  /**
   * Validation environment
   */
  environment: string;
  
  /**
   * Validation status
   */
  status: 'passed' | 'failed' | 'skipped';
  
  /**
   * Validation details
   */
  details?: Record<string, unknown>;
  
  /**
   * Error message (if failed)
   */
  errorMessage?: string;
  
  /**
   * Duration in milliseconds
   */
  duration?: number;
}

/**
 * Validation types
 */
export type ValidationType =
  | 'BUILD'
  | 'LINT'
  | 'TYPE_CHECK'
  | 'UNIT_TESTS'
  | 'INTEGRATION_TESTS'
  | 'E2E_TESTS'
  | 'WEBGL_SUPPORT'
  | 'PERFORMANCE_TEST'
  | 'ACCESSIBILITY_CHECK'
  | 'SECURITY_SCAN';

/**
 * Test results summary
 */
export interface TestResultsSummary {
  /**
   * Total tests count
   */
  total: number;
  
  /**
   * Passed tests count
   */
  passed: number;
  
  /**
   * Failed tests count
   */
  failed: number;
  
  /**
   * Skipped tests count
   */
  skipped: number;
  
  /**
   * Pass rate percentage
   */
  passRate: number;
  
  /**
   * Test framework used
   */
  framework: string;
  
  /**
   * Test execution timestamp
   */
  executedAt: string;
}

/**
 * Deployment information
 */
export interface DeploymentInfo {
  /**
   * Deployment status
   */
  status: 'not_deployed' | 'deployed' | 'failed';
  
  /**
   * Deployment target
   */
  target?: string;
  
  /**
   * Deployment URL
   */
  url?: string;
  
  /**
   * Deployment timestamp
   */
  deployedAt?: string;
  
  /**
   * Deployment environment
   */
  environment?: 'development' | 'staging' | 'production';
  
  /**
   * Deployment method
   */
  method?: 'manual' | 'railway' | 'vercel' | 'docker' | 'github_actions' | 'custom';
}

/**
 * Chinese sovereignty information (自主创新)
 */
export interface SovereigntyInfo {
  /**
   * Overall sovereignty compliance
   */
  compliant: boolean;
  
  /**
   * Compliance score (0-100)
   */
  complianceScore: number;
  
  /**
   * Checked at timestamp
   */
  checkedAt: string;
  
  /**
   * Use of Chinese mirrors
   */
  chineseMirrors: boolean;
  
  /**
   * Offline cache used
   */
  offlineCache: boolean;
  
  /**
   * Security validation passed
   */
  securityValidation: boolean;
  
  /**
   * Audit logging enabled
   */
  auditLogging: boolean;
  
  /**
   * Package replacements for sovereignty
   */
  packageReplacements: PackageReplacement[];
}

/**
 * Package replacement for sovereignty
 */
export interface PackageReplacement {
  /**
   * Original package name
   */
  original: string;
  
  /**
   * Replaced with Chinese package
   */
  replacedWith: string;
  
  /**
   * Reason for replacement
   */
  reason: string;
  
  /**
   * Replacement source (mirror, custom, etc.)
   */
  source: string;
}

/**
 * Additional metadata
 */
export interface Metadata {
  /**
   * Project name
   */
  projectName?: string;
  
  /**
   * Project description
   */
  projectDescription?: string;
  
  /**
   * Project version
   */
  projectVersion?: string;
  
  /**
   * Author name
   */
  author?: string;
  
  /**
   * Organization name
   */
  organization?: string;
  
  /**
   * Tags for categorization
   */
  tags?: string[];
  
  /**
   * Custom fields (extensible)
   */
  customFields?: Record<string, unknown>;
}

/**
 * Helper function to create a minimal escape.json structure
 */
export function createMinimalEscapeJson(escapeId: string): EscapeJson {
  return {
    $schema: 'https://raw.githubusercontent.com/escapekit/escapekit-mcp/main/schemas/escape-json-v1.schema.json',
    version: '1.0',
    escapeId,
    timestamp: new Date().toISOString(),
    provenance: {
      sandbox: 'unknown',
      sourceHash: '',
      files: [],
      detectedAt: new Date().toISOString(),
    },
    analysis: {
      analysisId: escapeId,
      analysisAt: new Date().toISOString(),
      escapeKitVersion: '1.0.0',
      config: {
        targetPlatform: 'nextjs',
        targetRuntime: 'node',
        strictness: 'standard',
        useChineseMirrors: false,
      },
      issues: [],
      confidenceScore: 0,
      totalIssues: 0,
      issueBreakdown: {
        ghostImports: 0,
        mockApis: 0,
        sandboxApis: 0,
        unrealisticAssumptions: 0,
        securityRisks: 0,
        performanceIssues: 0,
        codeQuality: 0,
        missingDependencies: 0,
        versionMismatches: 0,
        webglFallbacksNeeded: 0,
      },
    },
    transformations: {
      transformedAt: new Date().toISOString(),
      applied: [],
      totalTransformations: 0,
      breakdown: {
        importReplacements: 0,
        apiReplacements: 0,
        polyfillAdditions: 0,
        fallbackImplementations: 0,
        versionUpdates: 0,
        dependencyAdditions: 0,
        configGenerations: 0,
        codeRefactorings: 0,
      },
    },
    validations: {
      validations: [],
      overallStatus: 'pending',
      totalValidations: 0,
      passedValidations: 0,
      failedValidations: 0,
    },
    deployment: {
      status: 'not_deployed',
    },
    sovereignty: {
      compliant: false,
      complianceScore: 0,
      checkedAt: new Date().toISOString(),
      chineseMirrors: false,
      offlineCache: false,
      securityValidation: false,
      auditLogging: false,
      packageReplacements: [],
    },
    metadata: {},
  };
}