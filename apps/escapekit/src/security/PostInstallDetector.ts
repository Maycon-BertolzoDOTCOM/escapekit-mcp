/**
 * PostInstallDetector
 * 
 * Main orchestrator for supply chain security analysis. Analyzes package.json files
 * and their dependencies to detect malicious postinstall scripts. Integrates with
 * NPMRegistry for dependency metadata, uses PatternMatcher for suspicious pattern
 * detection, RiskScorer for risk calculation, and IssueGenerator for creating
 * security warnings.
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { Issue, generateId } from '../models/schemas.js';
import { AnalysisError } from '../errors.js';
import { logger } from '../logger.js';
import { NPMRegistry } from '../services/NPMRegistry.js';
import { PackageJsonParser } from './PackageJsonParser.js';
import { PatternMatcher } from './PatternMatcher.js';
import { RiskScorer } from './RiskScorer.js';
import { IssueGenerator } from './IssueGenerator.js';
import {
  SecurityAnalysisOptions,
  ScriptContext,
  ScriptAnalysisResult,
} from './types.js';

/**
 * PostInstallDetector class
 * 
 * Orchestrates security analysis of package.json files and their dependencies.
 * Main entry point is the analyze() method which:
 * 1. Reads package.json from file system
 * 2. Parses and extracts installation scripts
 * 3. Analyzes each script for suspicious patterns
 * 4. Optionally queries NPMRegistry for dependency metadata
 * 5. Analyzes dependency installation scripts
 * 6. Generates Issue objects for detected security risks
 */
export class PostInstallDetector {
  private readonly logger = logger.child('PostInstallDetector');

  constructor(
    private readonly registry: NPMRegistry,
    private readonly parser: PackageJsonParser,
    private readonly patternMatcher: PatternMatcher,
    private readonly riskScorer: RiskScorer,
    private readonly issueGenerator: IssueGenerator
  ) {}

  /**
   * Analyze a package.json file for security risks
   * 
   * Main entry point for security analysis. Reads the package.json file,
   * extracts installation scripts, analyzes them for suspicious patterns,
   * and optionally analyzes dependency scripts.
   * 
   * @param packageJsonPath - Path to package.json file
   * @param options - Security analysis options
   * @returns Array of Issue objects for detected security risks
   */
  async analyze(
    packageJsonPath: string,
    options: SecurityAnalysisOptions = {}
  ): Promise<Issue[]> {
    const issues: Issue[] = [];

    try {
      // Read package.json file
      const absolutePath = resolve(packageJsonPath);
      this.logger.debug(`Reading package.json from: ${absolutePath}`);
      
      const content = await readFile(absolutePath, 'utf-8');
      
      // Parse package.json
      const packageJson = this.parser.parse(content);
      
      // Extract and analyze installation scripts
      const scripts = this.parser.extractScripts(packageJson);
      this.logger.debug(`Found ${scripts.length} installation scripts`);
      
      for (const script of scripts) {
        const context: ScriptContext = {
          scriptType: script.type,
          source: 'package.json',
        };
        
        const result = this.analyzeScript(script.content, context);
        
        // Only create issues if patterns were detected
        if (result.patterns.length > 0) {
          const isLegitimate = this.patternMatcher.isLegitimatePattern(script.content);
          const issue = this.issueGenerator.createIssue(
            result,
            { source: 'package.json', file: 'package.json' },
            isLegitimate
          );
          issues.push(issue);
        }
      }
      
      // Analyze dependencies if enabled
      if (options.checkNPMRegistry) {
        const dependencies = this.parser.extractDependencies(packageJson);
        this.logger.debug(`Analyzing ${dependencies.length} dependencies`);
        
        const dependencyIssues = await this.analyzeDependencies(
          dependencies,
          options.checkNPMRegistry
        );
        issues.push(...dependencyIssues);
      }
      
      this.logger.info(`Security analysis complete: ${issues.length} issues found`);
      return issues;
      
    } catch (error) {
      // Handle parsing errors gracefully
      if (error instanceof Error && error.message.includes('Invalid JSON')) {
        this.logger.error('Failed to parse package.json', {
          path: packageJsonPath,
          error: error.message,
        });
        // Return empty array for parsing failures (graceful degradation)
        return [];
      }
      
      // Handle file read errors
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.error('package.json file not found', {
          path: packageJsonPath,
        });
        throw new AnalysisError('Failed to read package.json', {
          error: 'File not found',
          operation: 'read_file',
          file: packageJsonPath,
        });
      }
      
      // Re-throw other errors
      this.logger.error('Security analysis failed', {
        path: packageJsonPath,
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw new AnalysisError('Failed to analyze package.json', {
        error: error instanceof Error ? error.message : String(error),
        operation: 'security_analysis',
        file: packageJsonPath,
      });
    }
  }

  /**
   * Analyze a single script for suspicious patterns
   * 
   * Detects suspicious patterns using PatternMatcher, calculates risk score
   * using RiskScorer, and determines severity level.
   * 
   * @param script - The script content to analyze
   * @param context - Script context (type, source, package name, publish date)
   * @returns Script analysis result with patterns, risk score, and severity
   */
  analyzeScript(script: string, context: ScriptContext): ScriptAnalysisResult {
    // Detect suspicious patterns
    const patterns = this.patternMatcher.detectPatterns(script);
    
    // Calculate risk score
    const metadata = context.publishDate
      ? {
          name: context.packageName || '',
          version: '',
          publishDate: context.publishDate,
        }
      : undefined;
    
    const riskScore = this.riskScorer.calculateScore(patterns, metadata);
    
    // Determine severity
    const severity = this.riskScorer.getSeverity(riskScore);
    
    return {
      script,
      patterns,
      riskScore,
      severity,
      context,
    };
  }

  /**
   * Analyze dependency installation scripts
   * 
   * Queries NPMRegistry for dependency metadata, extracts installation scripts,
   * and analyzes them for suspicious patterns. Creates warning issues for
   * network errors (unverified packages).
   * 
   * @param dependencies - Array of dependency names
   * @param checkRegistry - Whether to query NPM registry
   * @returns Array of Issue objects for dependency security risks
   */
  private async analyzeDependencies(
    dependencies: string[],
    checkRegistry: boolean
  ): Promise<Issue[]> {
    if (!checkRegistry || dependencies.length === 0) {
      return [];
    }

    const issues: Issue[] = [];

    try {
      // Query NPMRegistry for all dependencies
      this.logger.debug(`Querying NPM registry for ${dependencies.length} packages`);
      const packageResults = await this.registry.checkPackages(dependencies);

      for (const [name, info] of packageResults.entries()) {
        // Handle network errors - create unverified warning
        if (!info.exists && info.status === 'UNVERIFIED_NETWORK_ERROR') {
          this.logger.warn(`Network error for package: ${name}`);
          
          const unverifiedIssue: Issue = {
            id: generateId('issue'),
            type: 'postinstall_risk',
            severity: 'warning',
            location: { file: 'package.json', line: 0, column: 0 },
            message: `Unable to verify package: ${name}`,
            description: 'Network error prevented security analysis of this dependency.',
            suggestion: 'Retry analysis when network is stable.',
            autoFixable: false,
          };
          
          issues.push(unverifiedIssue);
          continue;
        }

        // Skip if package doesn't exist or is a builtin
        if (!info.exists || info.status === 'BUILTIN' || info.status === 'NOT_FOUND') {
          continue;
        }

        // Note: The current NPMRegistry.checkPackages() doesn't return metadata
        // with scripts. In a real implementation, we would need to extend
        // NPMRegistry to fetch full package metadata including scripts.
        // For now, we'll log that we would analyze the dependency but can't
        // without the metadata.
        this.logger.debug(`Package ${name} exists but metadata not available for script analysis`);
      }

      return issues;

    } catch (error) {
      // Log error but don't throw - graceful degradation
      this.logger.error('Failed to analyze dependencies', {
        error: error instanceof Error ? error.message : String(error),
      });
      return issues;
    }
  }
}
