/**
 * Validation Engine Module
 *
 * @module validate
 */

// Core
export { ValidationEngine } from './ValidationEngine.js';

// Types
export type {
  ValidationOptions,
  ValidationEnvironment,
  ValidationLevel,
  IssueType,
  ValidationResult,
  BuildCheckResult,
  RuntimeCheckResult,
  DependencyCheckResult,
  WebGLCheckResult,
  SecurityCheckResult,
  Issue,
  Fix,
  Fixer,
  Environment,
  EnvironmentResult,
  Reporter,
  GhostPackage,
  OutdatedPackage,
  Vulnerability,
  HealthCheck,
  ApiCheck,
} from './types.js';
export { DEFAULT_OPTIONS } from './types.js';

// Validators
export { BuildValidator } from './validators/BuildValidator.js';
export { DependencyValidator } from './validators/DependencyValidator.js';
export { WebGLValidator } from './validators/WebGLValidator.js';

// Auto-fix
export { AutoFixEngine } from './auto-fix/AutoFixEngine.js';
export { MockReplacer } from './auto-fix/MockReplacer.js';
export { PolyfillInjector } from './auto-fix/PolyfillInjector.js';
export { FallbackGenerator } from './auto-fix/FallbackGenerator.js';
export { ConfigUpdater } from './auto-fix/ConfigUpdater.js';

// Environments
export { LocalEnvironment } from './environments/LocalEnvironment.js';
export { DockerEnvironment } from './environments/DockerEnvironment.js';
export { BrowserEnvironment } from './environments/BrowserEnvironment.js';

// Reporters
export { ValidationReporter } from './reporters/ValidationReporter.js';
export { CLIReporter } from './reporters/CLIReporter.js';
export { JSONReporter } from './reporters/JSONReporter.js';
