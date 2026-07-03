/**
 * IssueGenerator
 * 
 * Creates Issue objects from script analysis results. Formats clear, actionable
 * messages with risk scores, lists detected patterns, generates specific remediation
 * suggestions, and includes context about the source (package.json or dependency).
 */

import { Issue, generateId } from '../models/schemas.js';
import { ScriptAnalysisResult, IssueContext, DetectedPattern, PatternType } from './types.js';

/**
 * IssueGenerator class
 * 
 * Generates security issues from script analysis results with formatted messages,
 * descriptions, and remediation suggestions.
 */
export class IssueGenerator {
  /**
   * Create an Issue object from script analysis result
   * 
   * @param result - The script analysis result containing patterns, risk score, and severity
   * @param context - The issue context with source and package information
   * @param isLegitimate - Whether legitimate build patterns were detected
   * @returns Issue object with type 'postinstall_risk'
   */
  createIssue(
    result: ScriptAnalysisResult,
    context: IssueContext,
    isLegitimate = false
  ): Issue {
    const message = this.formatMessage(result.riskScore, context);
    const description = this.formatDescription(result, isLegitimate);
    const suggestion = this.generateSuggestions(result.patterns);

    return {
      id: generateId('issue'),
      type: 'postinstall_risk',
      detector: 'PostInstallDetector',
      severity: result.severity,
      location: {
        file: context.file || 'package.json',
        line: 0,
        column: 0,
      },
      message,
      description,
      suggestion,
      autoFixable: false,
    };
  }

  /**
   * Format the issue message with risk score and context
   * 
   * @param score - The risk score (0-100)
   * @param context - The issue context
   * @returns Formatted message string
   */
  formatMessage(score: number, context: IssueContext): string {
    if (context.source === 'dependency' && context.packageName) {
      return `Suspicious postinstall script detected in dependency "${context.packageName}" (risk score: ${score})`;
    }
    return `Suspicious postinstall script detected in package.json (risk score: ${score})`;
  }

  /**
   * Format the issue description with detected patterns and notes
   * 
   * @param result - The script analysis result
   * @param isLegitimate - Whether legitimate patterns were detected
   * @returns Formatted description string
   */
  private formatDescription(result: ScriptAnalysisResult, isLegitimate: boolean): string {
    let description = 'Detected suspicious patterns:\n';

    // Group patterns by type
    const patternsByType = new Map<PatternType, DetectedPattern[]>();
    for (const pattern of result.patterns) {
      if (!patternsByType.has(pattern.type)) {
        patternsByType.set(pattern.type, []);
      }
      const patterns = patternsByType.get(pattern.type);
      if (patterns) patterns.push(pattern);
    }

    // List patterns by type
    for (const [type, patterns] of patternsByType) {
      description += `\n- ${this.formatPatternType(type)}: ${patterns.length} instance(s)`;
      for (const pattern of patterns) {
        description += `\n  - "${pattern.match}" at line ${pattern.position.line}`;
      }
    }

    // Add publish date if available
    if (result.context.publishDate) {
      const daysAgo = Math.floor(
        (Date.now() - result.context.publishDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      description += `\n\nPackage published ${daysAgo} day(s) ago`;
      if (daysAgo < 7) {
        description += ' (recently published)';
      }
    }

    // Add legitimate build script note
    if (isLegitimate) {
      description += '\n\nNote: This may be a legitimate build script.';
    }

    return description;
  }

  /**
   * Format pattern type for display
   * 
   * @param type - The pattern type
   * @returns Human-readable pattern type name
   */
  private formatPatternType(type: PatternType): string {
    const typeNames: Record<PatternType, string> = {
      network_request: 'Network requests',
      env_access: 'Environment variable access',
      code_execution: 'Code execution',
      obfuscation: 'Obfuscation',
      file_system: 'File system operations',
      slopsquat: 'AI package hallucination / Slopsquat',
      unicode_homoglyph: 'Unicode homoglyph spoofing',
      unicode_bidi: 'Unicode bidirectional algorithm obfuscation',
      unicode_invisible: 'Invisible Unicode characters',
      hardcoded_secret: 'Hardcoded secret',
    };
    return typeNames[type];
  }

  /**
   * Generate remediation suggestions based on detected patterns
   * 
   * @param patterns - Array of detected patterns
   * @returns Combined remediation suggestions
   */
  generateSuggestions(patterns: DetectedPattern[]): string {
    // Get unique pattern types
    const patternTypes = new Set(patterns.map(p => p.type));

    // Generate suggestions for each pattern type
    const suggestions: string[] = [];
    for (const type of patternTypes) {
      const suggestion = this.getSuggestionForPattern(type);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    // Combine suggestions
    if (suggestions.length === 0) {
      return 'Review the script carefully and verify it is safe to execute.';
    }

    return suggestions.join('\n\n');
  }

  /**
   * Get specific suggestion text for a pattern type
   * 
   * @param type - The pattern type
   * @returns Suggestion text for the pattern type
   */
  private getSuggestionForPattern(type: PatternType): string {
    const suggestions: Record<PatternType, string> = {
      network_request: 'Review the external domains being contacted and verify they are legitimate',
      env_access: 'Audit environment variable usage and remove access to sensitive credentials',
      code_execution: 'Replace dynamic code execution with static alternatives',
      obfuscation: 'Investigate why code is obfuscated and consider alternative packages',
      file_system: 'Verify file operations are necessary and review file paths',
      slopsquat: 'This package strongly matches AI hallucination patterns. Verify its authenticity on the npm registry.',
      unicode_homoglyph: 'Package name uses confusable Unicode characters to masquerade as another package. Extremely high risk.',
      unicode_bidi: 'Code flow differs from visual representation. Highly suspect for malicious activity.',
      unicode_invisible: 'Invisible characters detected which may be used for obfuscation.',
      hardcoded_secret: 'Remove hardcoded secrets from source code and use environment variables or a secrets manager instead.',
    };
    return suggestions[type];
  }
}
