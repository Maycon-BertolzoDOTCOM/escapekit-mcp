/**
 * Confidence Calculator
 * 
 * Calculates confidence scores based on detected issues
 */

import { Issue, IssueType } from '../models/schemas.js';
import { DEFAULT_ANALYZER_CONFIG, type AnalyzerConfig } from '../config.js';
import { logger } from '../logger.js';

export interface ConfidenceMetrics {
  /** Overall confidence score (0-1) */
  score: number;
  /** Number of critical issues */
  criticalIssues: number;
  /** Number of error-level issues */
  errorIssues: number;
  /** Number of warning-level issues */
  warningIssues: number;
  /** Detailed breakdown by type */
  breakdown: Record<IssueType, number>;
  /** Confidence level description */
  level: 'critical' | 'low' | 'medium' | 'high' | 'excellent';
}

export class ConfidenceCalculator {
  private readonly config: AnalyzerConfig;
  private readonly logger = logger.child('ConfidenceCalculator');

  constructor(config: Partial<AnalyzerConfig> = {}) {
    this.config = { ...DEFAULT_ANALYZER_CONFIG, ...config };
  }

  /**
   * Calculate confidence score from issues
   */
  calculate(issues: Issue[]): ConfidenceMetrics {
    const breakdown = this.getIssueBreakdown(issues);
    const errorIssues = issues.filter(i => i.severity === 'error').length;
    const warningIssues = issues.filter(i => i.severity === 'warning').length;
    const criticalIssues = this.getCriticalIssueCount(issues);

    const score = this.computeScore(issues, breakdown);
    const level = this.getConfidenceLevel(score);

    this.logger.debug('Calculated confidence score', {
      score,
      level,
      totalIssues: issues.length,
      errorIssues,
      warningIssues,
    });

    return {
      score,
      criticalIssues,
      errorIssues,
      warningIssues,
      breakdown,
      level,
    };
  }

  /**
   * Compute the actual score (0-1)
   */
  private computeScore(issues: Issue[], breakdown: Record<IssueType, number>): number {
    // No issues = perfect score
    if (issues.length === 0) {
      return 1.0;
    }

    // Base score decreases with more issues
    const baseScore = Math.max(0, 1 - (issues.length * 0.1));

    // Adjust based on issue severity
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    const severityAdjustment = (errorCount * this.config.errorWeight) + (warningCount * this.config.warningWeight);
    const finalScore = Math.max(0, baseScore - severityAdjustment);

    // Adjust for ghost imports (critical issue)
    if (breakdown.ghost_import > 0) {
      const ghostImportPenalty = 0.3 * breakdown.ghost_import;
      const scoreWithGhostImportPenalty = Math.max(0, finalScore - ghostImportPenalty);
      return Math.min(1.0, scoreWithGhostImportPenalty);
    }

    return Math.min(1.0, finalScore);
  }

  /**
   * Get confidence level from score
   */
  private getConfidenceLevel(score: number): ConfidenceMetrics['level'] {
    if (score >= 0.9) return 'excellent';
    if (score >= 0.7) return 'high';
    if (score >= 0.4) return 'medium';
    if (score > 0.0) return 'low';
    return 'critical';
  }

  /**
   * Count critical issues (issues that prevent code from running)
   */
  private getCriticalIssueCount(issues: Issue[]): number {
    return issues.filter(issue => {
      // Ghost imports are critical (code won't work)
      if (issue.type === 'ghost_import') return true;
      
      // Security risks are critical
      if (issue.type === 'security_risk') return true;
      
      // Postinstall risks with error severity are critical
      if (issue.type === 'postinstall_risk' && issue.severity === 'error') return true;
      
      // Slopsquat/Unicode risks with error severity are critical
      if (issue.type === 'slopsquat_risk' && issue.severity === 'error') return true;
      if (issue.type === 'unicode_risk' && issue.severity === 'error') return true;
      
      return false;
    }).length;
  }

  /**
   * Get breakdown of issues by type
   */
  private getIssueBreakdown(issues: Issue[]): Record<IssueType, number> {
    const breakdown: Record<IssueType, number> = {
      ghost_import: 0,
      mock_api: 0,
      unrealistic_assumption: 0,
      security_risk: 0,
      infinite_loop: 0,
      postinstall_risk: 0,
      slopsquat_risk: 0,
      unicode_risk: 0,
      hardcoded_secret: 0,
      sql_injection: 0,
    };

    for (const issue of issues) {
      if (breakdown[issue.type] !== undefined) {
        breakdown[issue.type]++;
      }
    }

    return breakdown;
  }

  /**
   * Get recommendations based on confidence level
   */
  getRecommendations(metrics: ConfidenceMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.level === 'critical') {
      recommendations.push(
        '🚨 Code contains critical issues that prevent execution',
        '🔧 Fix all ghost imports before proceeding',
        '⚠️ Review all security risks immediately',
        '📝 Consider rewriting affected code sections'
      );
    } else if (metrics.level === 'low') {
      recommendations.push(
        '⚠️ Code requires significant modifications',
        '🔍 Address ghost imports and security risks first',
        '📝 Review and fix error-level issues',
        '💡 Consider alternative implementations for problematic code'
      );
    } else if (metrics.level === 'medium') {
      recommendations.push(
        '📝 Code needs moderate improvements',
        '🔧 Fix ghost imports to ensure compatibility',
        '⚠️ Review and address warning-level issues',
        '💡 Test code in target environment before deployment'
      );
    } else if (metrics.level === 'high') {
      recommendations.push(
        '✅ Code is in good shape',
        '🔍 Review remaining issues for potential improvements',
        '💡 Consider fixing warning-level issues for better reliability',
        '✨ Ready for most production environments'
      );
    } else if (metrics.level === 'excellent') {
      recommendations.push(
        '🎉 Code is in excellent condition',
        '✨ production-ready with minimal or no issues',
        '🚀 Minimal issues detected',
        '💡 Consider running automated tests for final validation'
      );
    }

    return recommendations;
  }

  /**
   * Get confidence description
   */
  getDescription(metrics: ConfidenceMetrics): string {
    const descriptions: Record<ConfidenceMetrics['level'], string> = {
      critical: 'Code will not work in production environment. Requires immediate attention.',
      low: 'Code has significant issues that need to be addressed before it can run reliably.',
      medium: 'Code has some issues but can potentially work with modifications.',
      high: 'Code is mostly ready with minor issues that should be reviewed.',
      excellent: 'Code is in excellent condition. production-ready with minimal or no issues.',
    };

    return descriptions[metrics.level];
  }
}

/**
 * Create a default ConfidenceCalculator instance
 */
export function createConfidenceCalculator(): ConfidenceCalculator {
  return new ConfidenceCalculator();
}