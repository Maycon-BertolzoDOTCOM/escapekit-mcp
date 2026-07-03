/**
 * ValidationEngine - Main orchestrator for the Validation Engine
 *
 * Coordinates BuildValidator, RuntimeValidator (via environments),
 * DependencyValidator, AutoFixEngine, and reporters to produce a
 * comprehensive validation report.
 *
 * @module validate/ValidationEngine
 */

import { logger } from '../logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ValidationOptions,
  ValidationResult,
  Issue,
  Fix,
  Environment,
  IssueType,
  WebGLCheckResult,
  SecurityCheckResult,
} from './types.js';
import type { SecurityValidationResult } from '../security/SecurityValidator.js';
import { SecurityValidator } from '../security/SecurityValidator.js';
import { DEFAULT_OPTIONS } from './types.js';
import { BuildValidator } from './validators/BuildValidator.js';
import { DependencyValidator } from './validators/DependencyValidator.js';
import { WebGLValidator } from './validators/WebGLValidator.js';
import { AutoFixEngine } from './auto-fix/AutoFixEngine.js';
import { LocalEnvironment } from './environments/LocalEnvironment.js';
import { DockerEnvironment } from './environments/DockerEnvironment.js';

/** Injected dependencies for ValidationEngine (testability) */
export interface ValidationEngineDeps {
  buildValidator?: BuildValidator;
  dependencyValidator?: DependencyValidator;
  webglValidator?: WebGLValidator;
  autoFixEngine?: AutoFixEngine;
  securityValidator?: SecurityValidator;
}

export class ValidationEngine {
  private readonly log = logger.child('ValidationEngine');
  private readonly buildValidator: BuildValidator;
  private readonly dependencyValidator: DependencyValidator;
  private readonly webglValidator: WebGLValidator;
  private readonly autoFixEngine: AutoFixEngine;
  private readonly securityValidator: SecurityValidator;

  private static readonly DEFAULT_MAX_ITERATIONS = 3;
  private static readonly MIN_ITERATIONS_LIMIT = 1;
  private static readonly MAX_ITERATIONS_LIMIT = 10;

  constructor(deps: ValidationEngineDeps = {}) {
    this.buildValidator = deps.buildValidator ?? new BuildValidator();
    this.dependencyValidator = deps.dependencyValidator ?? new DependencyValidator();
    this.webglValidator = deps.webglValidator ?? new WebGLValidator();
    this.autoFixEngine = deps.autoFixEngine ?? new AutoFixEngine();
    this.securityValidator = deps.securityValidator ?? new SecurityValidator();
  }

  private extractUrlFromLogs(logs: string[]): string | null {
    for (const log of logs) {
      const match = log.match(/http:\/\/(?:localhost|127\.0\.0\.1):\d+/);
      if (match) return match[0];
    }
    return null;
  }

  /** Count issues by severity */
  private static countBySeverity(issues: Issue[], severity: Issue['severity']): number {
    let count = 0;
    for (let i = 0; i < issues.length; i++) {
      if (issues[i].severity === severity) count++;
    }
    return count;
  }

  async validate(
    projectPath: string,
    options: Partial<ValidationOptions> = {}
  ): Promise<ValidationResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();
    this.log.info(`Starting validation for: ${projectPath}`);

    const issues: Issue[] = [];
    const fixesApplied: Fix[] = [];
    let webglResult: WebGLCheckResult | undefined;

    const buildResult = await this.buildValidator.validate(projectPath);
    for (const err of buildResult.errors) {
      issues.push({ ...err, detector: 'BuildValidator' });
    }

    const dependencyResult = await this.dependencyValidator.validate(projectPath);
    for (const ghost of dependencyResult.ghostPackages) {
      issues.push({
        type: 'GHOST_IMPORT',
        detector: 'DependencyValidator',
        severity: 'error',
        message: `Ghost package detected: ${ghost.name} (suggested: ${ghost.suggestedReplacement || 'none'})`,
        file: ghost.file,
        line: ghost.line,
        suggestion: ghost.suggestedReplacement
          ? `Replace with ${ghost.suggestedReplacement}`
          : undefined,
      });
    }
    for (const vuln of dependencyResult.vulnerabilities) {
      issues.push({
        type: vuln.severity === 'critical' ? 'SECURITY_VULNERABILITY' : 'SECURITY_WARNING',
        detector: 'DependencyValidator',
        severity: vuln.severity === 'critical' ? 'error' : 'warning',
        message: `${vuln.severity}: ${vuln.title} (${vuln.name})`,
        suggestion: vuln.fixAvailable ? 'Run npm audit fix' : undefined,
      });
    }

    const securityPackageResults: SecurityValidationResult[] = [];
    try {
      const packageNames = await this.collectPackageNames(projectPath, dependencyResult);

      for (const packageName of packageNames) {
        try {
          const secResult = await this.securityValidator.validate(packageName);
          securityPackageResults.push(secResult);

          if (secResult.safe === false) {
            issues.push({
              type: 'SECURITY_VULNERABILITY',
              severity: 'error',
              detector: 'SecurityValidator',
              message: `Security vulnerability in ${packageName}: ${secResult.vulnerabilities[0] || 'Unknown vulnerability'}`,
            });
          } else if (secResult.safe === true && secResult.warnings.length > 0) {
            issues.push({
              type: 'SECURITY_WARNING',
              severity: 'warning',
              detector: 'SecurityValidator',
              message: `Security warning for ${packageName}: ${secResult.warnings[0]}`,
            });
          }
        } catch (err) {
          this.log.warn(
            `Failed to validate package ${packageName}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    } catch (err) {
      this.log.warn(
        `Failed to collect package names: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (opts.level === 'standard' || opts.level === 'thorough') {
      const environment = this.createEnvironment(opts.environment);
      try {
        const envResult = await environment.test(projectPath);
        if (!envResult.passed) {
          issues.push({
            type: 'BUILD_ERROR',
            detector: 'BuildValidator',
            severity: 'error',
            message: `Runtime test failed: ${envResult.error || 'server did not start'}`,
          });
        }

        if (opts.level === 'thorough') {
          const url = envResult.detectedUrl ?? this.extractUrlFromLogs(envResult.logs);

          if (url) {
            try {
              webglResult = await this.webglValidator.validate(url);
              if (webglResult && !webglResult.passed && webglResult.jsErrors.length > 0) {
                issues.push({
                  type: 'WEBGL_ERROR',
                  severity: 'error',
                  detector: 'WebGLValidator',
                  message: webglResult.jsErrors[0],
                });
              }
            } catch (err) {
              this.log.warn(
                'WebGL validation failed: ' + (err instanceof Error ? err.message : String(err))
              );
            }
          }
        }
      } finally {
        await environment.cleanup();
      }
    }

    let iterationCount = 0;

    if (opts.autoFix && issues.length > 0) {
      const maxIter = this.clampIterations(opts.maxIterations);

      while (iterationCount < maxIter) {
        iterationCount++;
        const errorCount = ValidationEngine.countBySeverity(issues, 'error');

        this.log.info(
          `Auto-fix iteration ${iterationCount}/${maxIter} - ${errorCount} error issues (${issues.length} total)`,
          {
            iteration: iterationCount,
            maxIterations: maxIter,
            remainingErrors: errorCount,
            totalIssues: issues.length,
          }
        );

        const fixes = await this.autoFixEngine.fix(projectPath, issues);
        const appliedFixes = fixes.filter(f => f.applied);
        fixesApplied.push(...appliedFixes);
        issues.splice(0, issues.length);

        if (appliedFixes.length === 0) {
          this.log.warn('Stopping auto-fix - no fixes applied in this iteration');
          break;
        }

        // Revalidate after fixes
        const reDep = await this.dependencyValidator.validate(projectPath);
        for (const ghost of reDep.ghostPackages) {
          issues.push({
            type: 'GHOST_IMPORT',
            severity: 'error',
            message: `Ghost package still present: ${ghost.name}`,
            file: ghost.file,
            line: ghost.line,
          });
        }
        const reBuild = await this.buildValidator.validate(projectPath);
        for (const err of reBuild.errors) {
          issues.push(err);
        }

        const remainingErrors = ValidationEngine.countBySeverity(issues, 'error');
        this.log.info(
          `Iteration ${iterationCount} complete - applied ${appliedFixes.length} fixes, ${remainingErrors} error issues (${issues.length} total) remaining`,
          {
            iteration: iterationCount,
            fixesApplied: appliedFixes.length,
            remainingErrors,
            totalIssues: issues.length,
          }
        );

        if (remainingErrors === 0) {
          this.log.info('All error issues resolved');
          break;
        }
      }

      const finalErrors = ValidationEngine.countBySeverity(issues, 'error');
      if (iterationCount === maxIter && finalErrors > 0) {
        this.log.warn(
          `Reached max iterations (${maxIter}) with ${finalErrors} error issues remaining`
        );
      }
    }

    const canDeploy = ValidationEngine.countBySeverity(issues, 'error') === 0;
    const confidence = this.calculateConfidence(issues);
    const duration = Date.now() - startTime;

    const securityResult: SecurityCheckResult = {
      passed: securityPackageResults.every(r => r.safe),
      packageResults: securityPackageResults,
      vulnerablePackages: securityPackageResults
        .filter(r => r.vulnerabilities.length > 0)
        .map(r => r.packageName),
      deprecatedPackages: securityPackageResults
        .filter(r => r.deprecated === true || r.maintained === false)
        .map(r => r.packageName),
      licenseIssues: securityPackageResults
        .filter(r => r.licenseCompatible === false)
        .map(r => r.packageName),
    };

    const result: ValidationResult = {
      canDeploy,
      confidence,
      duration,
      checks: {
        build: buildResult,
        runtime: {
          passed: true,
          startupTime: 0,
          memoryUsage: 0,
          apiResponses: [],
          healthChecks: [],
        },
        dependencies: dependencyResult,
        webgl: webglResult,
        security: securityResult,
      },
      fixesApplied,
      remainingIssues: issues,
      recommendations: this.generateRecommendations(issues),
      iterationCount,
    };

    return result;
  }

  private createEnvironment(envType: string): Environment {
    switch (envType) {
      case 'docker':
        return new DockerEnvironment();
      case 'local':
      default:
        return new LocalEnvironment();
    }
  }

  private calculateConfidence(issues: Issue[]): number {
    if (issues.length === 0) return 1.0;
    const hasErrors = ValidationEngine.countBySeverity(issues, 'error') > 0;
    const hasWarnings = ValidationEngine.countBySeverity(issues, 'warning') > 0;
    if (hasErrors) return 0.1;
    if (hasWarnings) return 0.4;
    return 0.7;
  }

  private generateRecommendations(issues: Issue[]): string[] {
    return issues
      .filter(i => i.severity !== 'error')
      .map(i => i.suggestion || `Consider fixing: ${i.message}`);
  }

  private clampIterations(value: number | undefined): number {
    if (value === undefined) return ValidationEngine.DEFAULT_MAX_ITERATIONS;
    return Math.max(
      ValidationEngine.MIN_ITERATIONS_LIMIT,
      Math.min(ValidationEngine.MAX_ITERATIONS_LIMIT, value)
    );
  }

  private async collectPackageNames(
    projectPath: string,
    dependencyResult: import('./types.js').DependencyCheckResult
  ): Promise<string[]> {
    const names = new Set<string>();

    try {
      const packageJson = await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8');
      const { dependencies = {}, devDependencies = {} } = JSON.parse(packageJson);

      Object.keys(dependencies).forEach(name => names.add(name));
      Object.keys(devDependencies).forEach(name => names.add(name));
    } catch (err) {
      this.log.warn(
        `Failed to read package.json: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    dependencyResult.ghostPackages.forEach(pkg => names.add(pkg.name));
    dependencyResult.vulnerabilities.forEach(vuln => names.add(vuln.name));

    return Array.from(names);
  }

  canFix(issueType: string): boolean {
    return this.autoFixEngine.canFix(issueType as IssueType);
  }
}
