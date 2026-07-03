/**
 * EscapeJsonWriter - Generates escape.json protocol v1.0
 *
 * This file implements the generator for the escape.json protocol,
 * which serves as the "digital birth certificate" for projects analyzed by EscapeKit.
 *
 * @module generators/EscapeJsonWriter
 */

import { createHash } from 'crypto';
import { writeFile } from 'fs/promises';
import type { AnalysisResult } from '../models/schemas.js';
import type { DependencyResolution, CodeTransformation } from '../models/transformation.js';
import type {
  EscapeJson,
  Provenance,
  FileRecord,
  AnalysisInfo,
  DetectedIssue,
  IssueType,
  IssueBreakdown,
  Transformations,
  AppliedTransformation,
  TransformationType,
  TransformationBreakdown,
  Validations,
  TestResultsSummary,
  DeploymentInfo,
  SovereigntyInfo,
  Metadata,
} from '../models/escape-json-schema.js';
import { FileSystemError } from '../errors.js';

/** Parameters for generating escape.json */
export interface EscapeJsonParams {
  analysisResult: AnalysisResult;
  resolutions: DependencyResolution[];
  transformations: CodeTransformation[];
  originalCode?: string;
  originalFiles?: Array<{ path: string; size: number; language?: string }>;
  targetPlatform?: string;
  targetRuntime?: string;
  toolVersion?: string;
  kiwiTestRunId?: number;
  testResults?: TestResultsSummary;
  useChineseMirrors?: boolean;
  metadata?: Partial<Metadata>;
}

/**
 * Generates escape.json protocol v1.0 documents.
 *
 * The escape.json file provides complete traceability from source to production deployment,
 * including provenance, transformations, validations, and sovereignty information.
 *
 * @example
 * ```typescript
 * const writer = new EscapeJsonWriter();
 * const escapeJson = writer.generate({
 *   analysisResult,
 *   resolutions,
 *   transformations,
 *   kiwiTestRunId: 8,
 *   testResults: { total: 1168, passed: 1102, ... }
 * });
 * await writer.writeToFile(escapeJson, '/output/escape.json');
 * ```
 */
export class EscapeJsonWriter {
  /**
   * Generate an escape.json document from transformation data.
   *
   * @param params - Input data for escape.json generation
   * @returns A fully populated EscapeJson document
   */
  generate(params: EscapeJsonParams): EscapeJson {
    const {
      analysisResult,
      resolutions,
      transformations,
      originalCode = '',
      originalFiles = [],
      targetPlatform = 'nextjs',
      targetRuntime = 'node',
      toolVersion = '1.0.0',
      kiwiTestRunId,
      testResults,
      useChineseMirrors = false,
      metadata: customMetadata = {},
    } = params;

    const escapeId = analysisResult.analysisId;
    const timestamp = new Date().toISOString();

    // Build provenance section
    const provenance = this.buildProvenance(analysisResult, originalCode, originalFiles, timestamp);

    // Build analysis section
    const analysis = this.buildAnalysis(
      analysisResult,
      escapeId,
      timestamp,
      toolVersion,
      targetPlatform,
      targetRuntime,
      useChineseMirrors
    );

    // Build transformations section
    const transformInfo = this.buildTransformations(resolutions, transformations, timestamp);

    // Build validations section
    const validations = this.buildValidations(timestamp, kiwiTestRunId, testResults);

    // Build deployment section
    const deployment: DeploymentInfo = {
      status: 'not_deployed',
    };

    // Build sovereignty section
    const sovereignty = this.buildSovereignty(useChineseMirrors, timestamp);

    // Build metadata
    const meta: Metadata = {
      ...customMetadata,
      projectName: customMetadata.projectName,
    };

    return {
      $schema:
        'https://raw.githubusercontent.com/escapekit/escapekit-mcp/main/schemas/escape-json-v1.schema.json',
      version: '1.0',
      escapeId,
      timestamp,
      provenance,
      analysis,
      transformations: transformInfo,
      validations,
      deployment,
      sovereignty,
      metadata: meta,
    };
  }

  /**
   * Build the provenance section
   */
  private buildProvenance(
    analysisResult: AnalysisResult,
    originalCode: string,
    originalFiles: Array<{ path: string; size: number; language?: string }>,
    detectedAt: string
  ): Provenance {
    // Calculate source hash
    const sourceHash = originalCode
      ? this.calculateCodeHash(originalCode).replace('sha256:', '')
      : '';

    // Build file records
    const files: FileRecord[] = originalFiles.map(f => ({
      path: f.path,
      hash: '', // Will be calculated separately for each file
      size: f.size,
      type: (f.path.includes('test') ? 'test' : f.path.includes('config') ? 'config' : 'source') as
        | 'source'
        | 'config'
        | 'test',
      language: f.language,
    }));

    return {
      sandbox: analysisResult.sandboxType || 'unknown',
      sourceHash,
      files,
      detectedAt,
    };
  }

  /**
   * Build the analysis section
   */
  private buildAnalysis(
    analysisResult: AnalysisResult,
    analysisId: string,
    analysisAt: string,
    escapeKitVersion: string,
    targetPlatform: string,
    targetRuntime: string,
    useChineseMirrors: boolean
  ): AnalysisInfo {
    // Convert issues to detected issues format
    const issues = this.convertIssues(analysisResult);

    // Calculate issue breakdown
    const issueBreakdown = this.calculateIssueBreakdown(analysisResult);

    return {
      analysisId,
      analysisAt,
      escapeKitVersion,
      config: {
        targetPlatform,
        targetRuntime,
        strictness: 'standard',
        useChineseMirrors,
      },
      issues,
      confidenceScore: analysisResult.confidenceScore,
      totalIssues: analysisResult.summary.totalIssues,
      issueBreakdown,
    };
  }

  /**
   * Convert analysis issues to DetectedIssue format
   */
  private convertIssues(analysisResult: AnalysisResult): DetectedIssue[] {
    const issues: DetectedIssue[] = [];

    for (const issue of analysisResult.issues || []) {
      issues.push({
        type: this.mapIssueType(issue.type),
        severity: issue.severity as 'error' | 'warning' | 'info',
        filePath: issue.location?.file || '',
        line: issue.location?.line || 0,
        column: issue.location?.column,
        message: issue.message,
        suggestion: issue.suggestion,
        fixed: false,
      });
    }

    return issues;
  }

  /**
   * Map issue type string to IssueType enum
   */
  private mapIssueType(type: string): IssueType {
    const typeMap: Record<string, IssueType> = {
      ghost_import: 'GHOST_IMPORT',
      mock_api: 'MOCK_API',
      unrealistic_assumption: 'UNREALISTIC_ASSUMPTION',
      security_risk: 'SECURITY_RISK',
      infinite_loop: 'CODE_QUALITY',
      postinstall_risk: 'SECURITY_RISK',
      slopsquat_risk: 'SECURITY_RISK',
      unicode_risk: 'CODE_QUALITY',
    };

    return typeMap[type] || 'CODE_QUALITY';
  }

  /**
   * Calculate issue breakdown statistics
   */
  private calculateIssueBreakdown(analysisResult: AnalysisResult): IssueBreakdown {
    const breakdown: IssueBreakdown = {
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
    };

    for (const issue of analysisResult.issues || []) {
      switch (issue.type) {
        case 'ghost_import':
          breakdown.ghostImports++;
          break;
        case 'mock_api':
          breakdown.mockApis++;
          break;
        case 'unrealistic_assumption':
          breakdown.unrealisticAssumptions++;
          break;
        case 'security_risk':
        case 'slopsquat_risk':
        case 'postinstall_risk':
          breakdown.securityRisks++;
          break;
        case 'infinite_loop':
        case 'unicode_risk':
          breakdown.codeQuality++;
          break;
      }
    }

    return breakdown;
  }

  /**
   * Build the transformations section
   */
  private buildTransformations(
    resolutions: DependencyResolution[],
    transformations: CodeTransformation[],
    transformedAt: string
  ): Transformations {
    const applied: AppliedTransformation[] = [];

    // Add resolutions
    for (const res of resolutions) {
      applied.push({
        type: 'IMPORT_REPLACEMENT',
        filePath: 'unknown',
        originalCode: res.originalImport,
        transformedCode: `import from '${res.resolvedPackage}'`,
        reason: `Ghost import: ${res.originalImport} resolved via ${res.resolutionMethod}`,
        packageUsed: res.resolvedPackage,
        timestamp: transformedAt,
      });
    }

    // Add code transformations
    for (const transform of transformations) {
      applied.push({
        type: this.mapTransformationType(
          transform.appliedRules[0]?.ruleType || 'IMPORT_REPLACEMENT'
        ),
        filePath: 'unknown',
        originalCode: transform.sourceCode,
        transformedCode: transform.transformedCode,
        reason: transform.metadata?.diff ? 'Code transformation' : 'Code transformation',
        packageUsed: undefined,
        timestamp: transformedAt,
      });
    }

    // Calculate breakdown
    const breakdown = this.calculateTransformationBreakdown(applied);

    return {
      transformedAt,
      applied,
      totalTransformations: applied.length,
      breakdown,
    };
  }

  /**
   * Map transformation type string to TransformationType enum
   */
  private mapTransformationType(type: string): TransformationType {
    const typeMap: Record<string, TransformationType> = {
      IMPORT_REPLACEMENT: 'IMPORT_REPLACEMENT',
      API_REPLACEMENT: 'API_REPLACEMENT',
      POLYFILL_ADDITION: 'POLYFILL_ADDITION',
      FALLBACK_IMPLEMENTATION: 'FALLBACK_IMPLEMENTATION',
      VERSION_UPDATE: 'VERSION_UPDATE',
      DEPENDENCY_ADDITION: 'DEPENDENCY_ADDITION',
      CONFIG_GENERATION: 'CONFIG_GENERATION',
      CODE_REFACTORING: 'CODE_REFACTORING',
    };

    return typeMap[type] || 'CODE_REFACTORING';
  }

  /**
   * Calculate transformation breakdown statistics
   */
  private calculateTransformationBreakdown(
    applied: AppliedTransformation[]
  ): TransformationBreakdown {
    const breakdown: TransformationBreakdown = {
      importReplacements: 0,
      apiReplacements: 0,
      polyfillAdditions: 0,
      fallbackImplementations: 0,
      versionUpdates: 0,
      dependencyAdditions: 0,
      configGenerations: 0,
      codeRefactorings: 0,
    };

    for (const transform of applied) {
      switch (transform.type) {
        case 'IMPORT_REPLACEMENT':
          breakdown.importReplacements++;
          break;
        case 'API_REPLACEMENT':
          breakdown.apiReplacements++;
          break;
        case 'POLYFILL_ADDITION':
          breakdown.polyfillAdditions++;
          break;
        case 'FALLBACK_IMPLEMENTATION':
          breakdown.fallbackImplementations++;
          break;
        case 'VERSION_UPDATE':
          breakdown.versionUpdates++;
          break;
        case 'DEPENDENCY_ADDITION':
          breakdown.dependencyAdditions++;
          break;
        case 'CONFIG_GENERATION':
          breakdown.configGenerations++;
          break;
        case 'CODE_REFACTORING':
          breakdown.codeRefactorings++;
          break;
      }
    }

    return breakdown;
  }

  /**
   * Build the validations section
   */
  private buildValidations(
    _timestamp: string,
    kiwiTestRunId?: number,
    testResults?: TestResultsSummary
  ): Validations {
    const validations: Validations = {
      validations: [],
      overallStatus: 'pending',
      totalValidations: 0,
      passedValidations: 0,
      failedValidations: 0,
    };

    if (kiwiTestRunId) {
      validations.kiwiTestRunId = kiwiTestRunId;
    }

    if (testResults) {
      validations.testResults = testResults;
      validations.totalValidations = testResults.total;
      validations.passedValidations = testResults.passed;
      validations.failedValidations = testResults.failed;
      validations.overallStatus = testResults.failed > 0 ? 'partial' : 'passed';
    }

    return validations;
  }

  /**
   * Build the sovereignty section
   */
  private buildSovereignty(useChineseMirrors: boolean, checkedAt: string): SovereigntyInfo {
    return {
      compliant: useChineseMirrors,
      complianceScore: useChineseMirrors ? 100 : 0,
      checkedAt,
      chineseMirrors: useChineseMirrors,
      offlineCache: false,
      securityValidation: false,
      auditLogging: false,
      packageReplacements: [],
    };
  }

  /**
   * Serialize an EscapeJson document to JSON and write it to a file.
   *
   * @param escapeJson - The escape.json document to write
   * @param path - Destination file path
   * @throws FileSystemError if write fails
   */
  async writeToFile(escapeJson: EscapeJson, path: string): Promise<void> {
    const json = JSON.stringify(escapeJson, null, 2);
    try {
      await writeFile(path, json, 'utf-8');
    } catch (err) {
      throw new FileSystemError(
        `Failed to write escape.json to "${path}": ${(err as Error).message}`,
        'writeFile',
        { path }
      );
    }
  }

  /**
   * Calculate a SHA-256 hash of given code string.
   *
   * @param code - Source code to hash
   * @returns Hex-encoded SHA-256 hash
   */
  private calculateCodeHash(code: string): string {
    const hash = createHash('sha256').update(code, 'utf-8').digest('hex');
    return `sha256:${hash}`;
  }
}
