/**
 * RiskScorer - Calculates risk scores for installation scripts
 * 
 * Calculates risk scores (0-100) based on detected patterns and package metadata.
 * Different pattern types have different weights reflecting their threat level.
 */

import { ErrorSeverity } from '../models/schemas.js';
import { DetectedPattern, PackageMetadata, ScoringWeights } from './types.js';

/**
 * Scoring weights for different pattern types
 * Higher weights indicate more severe security risks
 */
export const SCORING_WEIGHTS: ScoringWeights = {
  network_request: 30,
  env_access: 40,
  code_execution: 25,
  obfuscation: 20,
  file_system: 15,
  recent_publish: 10,
  slopsquat: 45,
  unicode_homoglyph: 50,
  unicode_bidi: 50,
  unicode_invisible: 40,
  hardcoded_secret: 50,
};

/**
 * RiskScorer calculates risk scores based on detected patterns
 */
export class RiskScorer {
  private weights: ScoringWeights;

  constructor(weights: ScoringWeights = SCORING_WEIGHTS) {
    this.weights = weights;
  }

  /**
   * Calculate risk score based on detected patterns and metadata
   * 
   * Algorithm:
   * 1. Deduplicate pattern types using Set (same type counted once)
   * 2. Sum weights for unique pattern types
   * 3. Apply recency bonus if package published < 7 days ago
   * 4. Cap final score at 100
   * 
   * @param patterns - Detected suspicious patterns
   * @param metadata - Optional package metadata (for recency bonus)
   * @returns Risk score (0-100)
   */
  calculateScore(
    patterns: DetectedPattern[],
    metadata?: PackageMetadata,
    now: Date = new Date()
  ): number {
    let score = 0;

    // Deduplicate pattern types - same type counted only once
    const patternTypes = new Set(patterns.map(p => p.type));

    // Sum weights for unique pattern types
    for (const type of patternTypes) {
      score += this.weights[type];
    }

    // Apply recency bonus if applicable
    if (metadata?.publishDate) {
      score = this.applyRecencyBonus(score, metadata.publishDate, now);
    }

    // Cap at 100
    return Math.min(score, 100);
  }

  /**
   * Map risk score to severity level
   * 
   * Severity mapping:
   * - score > 70: "error" (critical security risk)
   * - score 40-70: "warning" (moderate security risk)
   * - score < 40: "info" (low security risk)
   * 
   * @param score - Risk score (0-100)
   * @returns Severity level
   */
  getSeverity(score: number): ErrorSeverity {
    if (score > 70) {
      return 'error';
    }
    if (score >= 40) {
      return 'warning';
    }
    return 'info';
  }

  /**
   * Apply recency bonus for recently published packages
   * 
   * Packages published less than 7 days ago are riskier because:
   * - They may be newly compromised accounts
   * - They haven't been vetted by the community
   * - They may be typosquatting attempts
   * 
   * @param score - Current risk score
   * @param publishDate - Package publish date
   * @returns Adjusted score with recency bonus
   */
  applyRecencyBonus(score: number, publishDate: Date, now: Date = new Date()): number {
    const daysSincePublish = 
      (now.getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSincePublish < 7) {
      return score + this.weights.recent_publish;
    }
    
    return score;
  }
}
