/**
 * Code Analyzer
 * 
 * Main analyzer that orchestrates parsing, npm registry queries,
 * and issue detection to produce a complete analysis result
 */

import { JavaScriptAnalyzer } from './JavaScriptAnalyzer.js';
import {
  ImportStatement,
  MockApiCall,
  WebGLUsage,
} from './BaseParser.js';
import { NPMRegistry } from '../services/NPMRegistry.js';
import { SandboxDetector } from '../detectors/SandboxDetector.js';
import { ConfidenceCalculator } from '../utils/ConfidenceCalculator.js';
import {
  Issue,
  AnalysisResult,
  AnalysisSummary,
  generateId,
} from '../models/schemas.js';
import { logger } from '../logger.js';
import { AnalysisError } from '../errors.js';
import { PostInstallDetector } from '../security/PostInstallDetector.js';
import { PackageJsonParser } from '../security/PackageJsonParser.js';
import { PatternMatcher } from '../security/PatternMatcher.js';
import { RiskScorer } from '../security/RiskScorer.js';
import { IssueGenerator } from '../security/IssueGenerator.js';
import { SlopsquatDetector } from '../security/SlopsquatDetector.js';
import { UnicodeAnalyzer } from '../security/UnicodeAnalyzer.js';

interface AnalysisOptions {
  sandboxType?: string;
  language?: string;
  checkNPMRegistry?: boolean;
  enableSecurityAnalysis?: boolean;
}

export class CodeAnalyzer {
  private registry: NPMRegistry;
  private jsAnalyzer: JavaScriptAnalyzer;
  private sandboxDetector: SandboxDetector;
  private confidenceCalculator: ConfidenceCalculator;
  private postInstallDetector: PostInstallDetector;
  private slopsquatDetector: SlopsquatDetector;
  private unicodeAnalyzer: UnicodeAnalyzer;
  private readonly logger = logger.child('CodeAnalyzer');

  constructor() {
    this.registry = new NPMRegistry();
    this.jsAnalyzer = new JavaScriptAnalyzer();
    this.sandboxDetector = new SandboxDetector();
    this.confidenceCalculator = new ConfidenceCalculator();
    this.postInstallDetector = new PostInstallDetector(
      this.registry,
      new PackageJsonParser(),
      new PatternMatcher(),
      new RiskScorer(),
      new IssueGenerator()
    );
    this.slopsquatDetector = new SlopsquatDetector();
    this.unicodeAnalyzer = new UnicodeAnalyzer();
  }

  /**
   * Analyze code and produce complete result
   */
  async analyze(code: string, options: AnalysisOptions = {}): Promise<AnalysisResult> {
    this.logger.debug('Starting analysis', { options });

    try {
      const { sandboxType, language = 'javascript', checkNPMRegistry = true } = options;

      // Parse code
      const parseResult = this.jsAnalyzer.parse(code);

      // Detect sandbox type if not provided
      const detectedSandboxType = sandboxType || this.sandboxDetector.detect(code);
      this.logger.debug('Sandbox type detected', { sandboxType: detectedSandboxType });

      // Identify ghost imports
      const ghostImports = await this.detectGhostImports(
        parseResult.imports, 
        checkNPMRegistry,
        options.enableSecurityAnalysis || false
      );

      // Identify mock API issues
      const mockApiIssues = this.detectMockApiIssues(parseResult.mockApis);

      // Identify WebGL issues
      const webglIssues = this.detectWebGLIssues(parseResult.webglUsages);

      // Perform security analysis if enabled
      let securityIssues: Issue[] = [];
      if (options.enableSecurityAnalysis) {
        try {
          this.logger.debug('Running security analysis');
          
          // Unicode analysis on the source code
          const codeUnicodeIssues = this.unicodeAnalyzer.analyze(code, 'script');
          securityIssues.push(...codeUnicodeIssues);

          const postInstallIssues = await this.postInstallDetector.analyze('package.json', {
            checkNPMRegistry,
          });
          securityIssues.push(...postInstallIssues);
          
          this.logger.debug('Security analysis completed', { issuesFound: securityIssues.length });
        } catch (error) {
          this.logger.error('Security analysis failed', {
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with other analysis even if security analysis fails
        }
      }

      // Combine all issues
      const allIssues = [...ghostImports, ...mockApiIssues, ...webglIssues, ...securityIssues];

      // Calculate summary
      const summary = this.calculateSummary(allIssues);

      // Calculate confidence score using ConfidenceCalculator
      const confidenceMetrics = this.confidenceCalculator.calculate(allIssues);

      this.logger.debug('Analysis completed', {
        sandboxType: detectedSandboxType,
        totalIssues: allIssues.length,
        confidenceScore: confidenceMetrics.score,
      });

      return {
        analysisId: generateId('analysis'),
        timestamp: new Date().toISOString(),
        sandboxType: detectedSandboxType,
        language,
        summary,
        issues: allIssues,
        confidenceScore: confidenceMetrics.score,
      };
    } catch (error) {
      this.logger.error('Analysis failed', { 
        error: error instanceof Error ? error.message : String(error),
        options,
      });
      
      throw new AnalysisError('Failed to analyze code', {
        error: error instanceof Error ? error.message : String(error),
        operation: 'analyze',
        codeLength: code?.length,
        options,
      });
    }
  }

  /**
   * Detect ghost imports (non-existent packages)
   */
  private async detectGhostImports(
    imports: ImportStatement[],
    checkNPMRegistry: boolean,
    enableSecurityAnalysis: boolean
  ): Promise<Issue[]> {
    const issues: Issue[] = [];

    // Get package names from imports
    const packageNames = this.jsAnalyzer.getPackageNames(imports);

    if (checkNPMRegistry && packageNames.length > 0) {
      // Check all packages against npm registry
      const packageResults = await this.registry.checkPackages(packageNames);

      for (const [name, info] of packageResults.entries()) {
        // Run Unicode and Slopsquatting checks 
        if (enableSecurityAnalysis) {
          const unicodeIssues = this.unicodeAnalyzer.analyze(name, 'package_name');
          issues.push(...unicodeIssues);

          const slopsquatIssue = await this.slopsquatDetector.analyze(name);
          if (slopsquatIssue) {
            issues.push(slopsquatIssue);
          }
        }

        if (!info.exists) {
          let severity: 'error' | 'warning' = 'error';
          let message = `Ghost import: Package "${name}" does not exist on npm`;
          let description = `This package is likely a sandbox-specific mock or does not exist in the public npm registry.`;
          let suggestion = `Consider using a real alternative or removing this import.`;

          // Handle different status types
          switch (info.status) {
            case 'UNVERIFIED_NETWORK_ERROR':
              severity = 'warning';
              message = `Network error checking package: "${name}"`;
              description = `Unable to verify package existence due to network issues. This package may be a sandbox-specific mock or may exist but couldn't be verified.`;
              suggestion = `Check your network connection and retry, or consider using a real alternative if this is a sandbox mock.`;
              break;
            case 'UNVERIFIED_TIMEOUT':
              severity = 'warning';
              message = `Timeout checking package: "${name}"`;
              description = `Package verification timed out. This package may be a sandbox-specific mock or verification failed due to slow network.`;
              suggestion = `Check your network connection and retry, or consider using a real alternative if this is a sandbox mock.`;
              break;
            case 'NOT_FOUND':
              // Default error case - package definitely doesn't exist
              break;
            case 'BUILTIN':
              // This shouldn't happen in this loop since builtins are handled separately
              continue;
            case 'FOUND':
              // This shouldn't happen since we're in the !info.exists branch
              continue;
          }

          issues.push({
            id: generateId('issue'),
            type: 'ghost_import',
            severity,
            location: {
              line: 0, // Would need to track import line
              column: 0,
            },
            message,
            description,
            suggestion,
            autoFixable: false,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Detect mock API issues
   */
  private detectMockApiIssues(mockApis: MockApiCall[]): Issue[] {
    return mockApis.map(api => ({
      id: generateId('issue'),
      type: 'mock_api',
      severity: 'warning',
      location: {
        line: api.line,
        column: api.column,
      },
      message: `Mock API detected: ${api.function}`,
      description: `Using mock API endpoints (${api.endpoint}) which will not work outside the sandbox environment.`,
      suggestion: `Replace with real API endpoints or implement proper error handling for production.`,
      autoFixable: false,
    }));
  }

  /**
   * Detect WebGL issues
   */
  private detectWebGLIssues(webglUsages: WebGLUsage[]): Issue[] {
    const issues: Issue[] = [];

    for (const usage of webglUsages) {
      issues.push({
        id: generateId('issue'),
        type: 'unrealistic_assumption',
        severity: 'warning',
        location: {
          line: usage.line,
          column: usage.column,
        },
        message: `WebGL usage detected: ${usage.type}`,
        description: `WebGL may not be available in all production environments. Consider implementing fallback strategies.`,
        suggestion: `Add WebGL support detection and fallback to Canvas 2D or static rendering when WebGL is not available.`,
        autoFixable: true,
      });
    }

    return issues;
  }

  /**
   * Calculate issue summary
   */
  private calculateSummary(issues: Issue[]): AnalysisSummary {
    const summary: AnalysisSummary = {
      totalIssues: issues.length,
      ghostImports: 0,
      mockApis: 0,
      unrealisticAssumptions: 0,
      securityRisks: 0,
      infiniteLoops: 0,
    };

    for (const issue of issues) {
      switch (issue.type) {
        case 'ghost_import':
          summary.ghostImports++;
          break;
        case 'mock_api':
          summary.mockApis++;
          break;
        case 'unrealistic_assumption':
          summary.unrealisticAssumptions++;
          break;
        case 'security_risk':
          summary.securityRisks++;
          break;
        case 'infinite_loop':
          summary.infiniteLoops++;
          break;
        case 'postinstall_risk':
        case 'slopsquat_risk':
        case 'unicode_risk':
          summary.securityRisks++;
          break;
      }
    }

    return summary;
  }

  /**
   * Clear npm registry cache
   */
  clearCache(): void {
    this.registry.clearCache();
  }
}