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
import type {
  ValidationOptions,
  ValidationResult,
  Issue,
  Fix,
  Environment,
  IssueType,
} from './types.js';
import { DEFAULT_OPTIONS } from './types.js';
import { BuildValidator } from './validators/BuildValidator.js';
import { DependencyValidator } from './validators/DependencyValidator.js';
import { AutoFixEngine } from './auto-fix/AutoFixEngine.js';
import { LocalEnvironment } from './environments/LocalEnvironment.js';
import { DockerEnvironment } from './environments/DockerEnvironment.js';

export class ValidationEngine {
  private readonly log = logger.child('ValidationEngine');
  private readonly buildValidator: BuildValidator;
  private readonly dependencyValidator: DependencyValidator;
  private readonly autoFixEngine: AutoFixEngine;

  constructor() {
    this.buildValidator = new BuildValidator();
    this.dependencyValidator = new DependencyValidator();
    this.autoFixEngine = new AutoFixEngine();
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

    const buildResult = await this.buildValidator.validate(projectPath);
    for (const err of buildResult.errors) {
      issues.push(err);
    }

    const dependencyResult = await this.dependencyValidator.validate(projectPath);
    for (const ghost of dependencyResult.ghostPackages) {
      issues.push({
        type: 'GHOST_IMPORT',
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
        severity: vuln.severity === 'critical' ? 'error' : 'warning',
        message: `${vuln.severity}: ${vuln.title} (${vuln.name})`,
        suggestion: vuln.fixAvailable ? 'Run npm audit fix' : undefined,
      });
    }

    if (opts.level === 'standard' || opts.level === 'thorough') {
      const environment = this.createEnvironment(opts.environment);
      try {
        const envResult = await environment.test(projectPath);
        if (!envResult.passed) {
          issues.push({
            type: 'BUILD_ERROR',
            severity: 'error',
            message: `Runtime test failed: ${envResult.error || 'server did not start'}`,
          });
        }
      } finally {
        await environment.cleanup();
      }
    }

    if (opts.autoFix && issues.length > 0) {
      const fixes = await this.autoFixEngine.fix(projectPath, issues);
      fixesApplied.push(...fixes.filter(f => f.applied));
      issues.length = 0;

      const appliedFixes = fixes.filter(f => f.applied);
      if (appliedFixes.length > 0) {
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
      }
    }

    const canDeploy = issues.filter(i => i.severity === 'error').length === 0;
    const confidence = this.calculateConfidence(issues);
    const duration = Date.now() - startTime;

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
      },
      fixesApplied,
      remainingIssues: issues,
      recommendations: this.generateRecommendations(issues),
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
    const severity = issues.reduce((max, i) => {
      if (i.severity === 'error') return Math.max(max, 3);
      if (i.severity === 'warning') return Math.max(max, 2);
      return Math.max(max, 1);
    }, 0);
    if (severity >= 3) return 0.1;
    if (severity === 2) return 0.4;
    return 0.7;
  }

  private generateRecommendations(issues: Issue[]): string[] {
    return issues
      .filter(i => i.severity !== 'error')
      .map(i => i.suggestion || `Consider fixing: ${i.message}`);
  }

  canFix(issueType: string): boolean {
    return this.autoFixEngine.canFix(issueType as IssueType);
  }
}
