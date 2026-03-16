/**
 * Recommendation Types
 */

export interface Recommendation {
  /** Unique identifier for this recommendation */
  id: string;
  /** Title of the recommendation */
  title: string;
  /** Description of the problem */
  description: string;
  /** Severity level */
  severity: 'error' | 'warning';
  /** Type of problem */
  problemType: string;
  /** Step-by-step instructions */
  steps: string[];
  /** Quick fix commands (if applicable) */
  commands?: string[];
  /** References to documentation */
  references?: string[];
}

export interface RecommendationContext {
  /** Detected framework (optional) */
  framework?: string;
  /** Target platform */
  platform?: string;
  /** Dependencies detected */
  dependencies?: string[];
  /** Source sandbox (optional) */
  sandboxType?: string;
}

export interface RecommendationEngineOptions {
  /** Problem type to generate recommendations for */
  problemType: string;
  /** Additional context */
  context?: RecommendationContext;
}

export interface RecommendationTemplate {
  /** Unique identifier */
  id: string;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Severity */
  severity: 'error' | 'warning';
  /** Summary */
  summary: string;
  /** Detection criteria */
  detectionCriteria?: string[];
  /** Common patterns */
  commonPatterns?: Array<{
    original: string;
    correct: string;
    description: string;
  }>;
  /** Recommended actions */
  recommendedActions: Array<{
    id: string;
    title: string;
    steps: string[];
    commands?: string[];
    references?: string[];
  }>;
  /** Prevention tips */
  prevention?: string[];
}