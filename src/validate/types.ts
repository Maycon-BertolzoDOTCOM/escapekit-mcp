/**
 * Validation Engine - Shared Types
 *
 * @module validate/types
 */

/** Validation environment */
export type ValidationEnvironment = 'docker' | 'local' | 'both';

/** Validation level controlling depth of checks */
export type ValidationLevel = 'basic' | 'standard' | 'thorough';

/** Issue type for auto-fix routing */
export type IssueType =
  | 'BUILD_ERROR'
  | 'GHOST_IMPORT'
  | 'SECURITY_VULNERABILITY'
  | 'SECURITY_WARNING'
  | 'WEBGL_UNSUPPORTED'
  | 'MISSING_POLYFILL'
  | 'OUTDATED_CONFIG'
  | 'MISSING_DEPENDENCY';

/** Options for the ValidationEngine */
export interface ValidationOptions {
  environment: ValidationEnvironment;
  level: ValidationLevel;
  autoFix: boolean;
  timeout: number; // ms
  fuzzyThreshold?: number;
  maxIterations?: number; // Optional max iterations for auto-fix
}

/** A fix applied during auto-fix */
export interface Fix {
  issueType: IssueType;
  description: string;
  file?: string;
  applied: boolean;
  error?: string;
}

/** A remaining issue after validation */
export interface Issue {
  type: IssueType;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
  detector?: string;
}

/** Build validation result */
export interface BuildCheckResult {
  passed: boolean;
  installTime: number;
  buildTime: number;
  errors: Issue[];
  warnings: string[];
  bundleSize?: number;
}

/** Runtime validation result */
export interface RuntimeCheckResult {
  passed: boolean;
  startupTime: number;
  memoryUsage: number;
  apiResponses: ApiCheck[];
  healthChecks: HealthCheck[];
}

/** Single API response check */
export interface ApiCheck {
  endpoint: string;
  method: string;
  status: number;
  latencyMs: number;
  passed: boolean;
  error?: string;
}

/** Single health check */
export interface HealthCheck {
  name: string;
  passed: boolean;
  message?: string;
  latencyMs: number;
}

/** Ghost package detected */
export interface GhostPackage {
  name: string;
  importPath: string;
  file: string;
  line: number;
  suggestedReplacement?: string;
}

/** Outdated package */
export interface OutdatedPackage {
  name: string;
  current: string;
  wanted: string;
  latest: string;
}

/** Vulnerability from npm audit */
export interface Vulnerability {
  name: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  title: string;
  url?: string;
  fixAvailable: boolean;
}

/** Dependency validation result */
export interface DependencyCheckResult {
  passed: boolean;
  ghostPackages: GhostPackage[];
  outdatedPackages: OutdatedPackage[];
  vulnerabilities: Vulnerability[];
  missingPeerDeps: string[];
}

/** WebGL validation result */
export interface WebGLCheckResult {
  passed: boolean;
  hasCanvas: boolean;
  hasWebGL: boolean;
  hasWebGL2: boolean;
  fallbackApplied: boolean;
  jsErrors: string[];
  loadTimeMs: number;
}

/** Security check result */
export interface SecurityCheckResult {
  passed: boolean;
  vulnerabilities: Vulnerability[];
  warnings: string[];
  licenseIssues: string[];
}

/** Aggregated validation result */
export interface ValidationResult {
  canDeploy: boolean;
  confidence: number; // 0-1
  duration: number; // ms
  checks: {
    build: BuildCheckResult;
    runtime: RuntimeCheckResult;
    dependencies: DependencyCheckResult;
    webgl?: WebGLCheckResult;
    security?: SecurityCheckResult;
  };
  fixesApplied: Fix[];
  remainingIssues: Issue[];
  recommendations: string[];
  iterationCount: number; // Number of auto-fix iterations performed
}

/** Fixer interface for auto-fix implementations */
export interface Fixer {
  fix(projectPath: string, issue: Issue): Promise<Fix>;
}

/** Environment interface for runtime testing */
export interface Environment {
  name: string;
  test(projectPath: string): Promise<EnvironmentResult>;
  cleanup(): Promise<void>;
}

/** Environment test result */
export interface EnvironmentResult {
  name: string;
  passed: boolean;
  startupTimeMs: number;
  healthChecks: HealthCheck[];
  apiTests: ApiCheck[];
  logs: string[];
  error?: string;
}

/** Reporter interface */
export interface Reporter {
  report(result: ValidationResult): Promise<void>;
}

/** Default validation options */
export const DEFAULT_OPTIONS: ValidationOptions = {
  environment: 'local',
  level: 'standard',
  autoFix: false,
  timeout: 300000,
};
