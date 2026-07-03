/**
 * Context Compaction — Types and interfaces
 *
 * Multi-tier context management system inspired by Claude Code's
 * services/compact/ hierarchy.
 */

/**
 * Compaction result
 */
export interface CompactResult {
  /** Number of items compacted */
  compacted: number;
  /** Tokens saved (estimated) */
  tokensSaved: number;
  /** Strategy used */
  strategy: 'time_based' | 'session_memory' | 'auto' | 'none';
  /** Duration in ms */
  durationMs: number;
}

/**
 * Message for compaction
 */
export interface CompactableMessage {
  id: string;
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result';
  timestamp: number;
  /** Token count estimate */
  tokens?: number;
  /** Whether this message has been summarized */
  summarized?: boolean;
  /** Content preview for debugging */
  preview?: string;
}

/**
 * Compaction configuration
 */
export interface CompactConfig {
  /** Max gap in ms before time-based clearing triggers (default: 3600000 = 1 hour) */
  timeBasedThresholdMs?: number;
  /** Max tokens before auto-compact triggers (default: 180000) */
  autoCompactThresholdTokens?: number;
  /** Max consecutive failures before circuit breaker trips (default: 3) */
  maxConsecutiveFailures?: number;
  /** Content replacement for cleared messages */
  clearedContent?: string;
}

/**
 * Compaction tracker state
 */
export interface CompactTrackingState {
  /** Last assistant message timestamp */
  lastAssistantTimestamp: number;
  /** Consecutive compaction failures */
  consecutiveFailures: number;
  /** Whether circuit breaker is tripped */
  circuitBroken: boolean;
  /** Total items compacted */
  totalCompacted: number;
}
