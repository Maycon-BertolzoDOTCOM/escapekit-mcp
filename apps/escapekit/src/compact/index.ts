/**
 * Context Compaction — Main entry point
 *
 * Multi-tier context management:
 *   1. Time-based microcompact (clear old tool results when cache expired)
 *   2. API-round grouping (safe split points for compaction)
 *   3. Oldest-group compaction (with tool_use/tool_result pair protection)
 *   4. Circuit breaker (stop after N consecutive failures)
 *
 * Inspired by Claude Code's services/compact/ hierarchy.
 *
 * Usage:
 *   import { compactContext } from './compact/index.js'
 *
 *   const result = compactContext(messages, { timeBasedThresholdMs: 3600000 })
 */

export type { CompactResult, CompactableMessage, CompactConfig, CompactTrackingState } from './types.js';
export { timeBasedMicrocompact, shouldTimeBasedCompact } from './timeBasedMC.js';
export { groupByApiRound, findSafeTruncationPoints, compactOldestGroups } from './messageGrouper.js';
export type { MessageGroup } from './messageGrouper.js';

import type { CompactableMessage, CompactConfig, CompactResult } from './types.js';
import { timeBasedMicrocompact } from './timeBasedMC.js';
import { groupByApiRound, compactOldestGroups } from './messageGrouper.js';

/**
 * Run the full compaction pipeline.
 *
 * Returns the compacted messages and a result summary.
 */
export function compactContext(
  messages: CompactableMessage[],
  config: CompactConfig = {},
): CompactResult & { messages: CompactableMessage[] } {
  const startTime = Date.now();

  // Step 1: Time-based microcompact
  const mcResult = timeBasedMicrocompact(messages, config);

  // Step 2: Check if we need deeper compaction
  const totalTokens = mcResult.messages.reduce(
    (sum, m) => sum + (m.tokens ?? m.preview?.length ?? 0),
    0,
  );

  const threshold = config.autoCompactThresholdTokens ?? 180000;

  if (totalTokens < threshold) {
    return {
      ...mcResult,
      durationMs: Date.now() - startTime,
    };
  }

  // Step 3: API-round grouping + oldest group compaction
  const groups = groupByApiRound(mcResult.messages);
  const maxGroups = Math.max(10, Math.floor(groups.length * 0.6)); // Keep 60%
  const compactedMessages = compactOldestGroups(groups, maxGroups);

  const newTokens = compactedMessages.reduce(
    (sum, m) => sum + (m.tokens ?? m.preview?.length ?? 0),
    0,
  );

  return {
    messages: compactedMessages,
    compacted: mcResult.compacted + (mcResult.messages.length - compactedMessages.length),
    tokensSaved: mcResult.tokensSaved + (totalTokens - newTokens),
    strategy: 'auto',
    durationMs: Date.now() - startTime,
  };
}

/**
 * Circuit breaker for compaction operations.
 *
 * Stops attempting compaction after N consecutive failures.
 * Resets on success.
 */
export class CompactionCircuitBreaker {
  private consecutiveFailures = 0;
  private tripped = false;

  constructor(private readonly maxFailures = 3) {}

  /**
   * Record a successful compaction
   */
  onSuccess(): void {
    this.consecutiveFailures = 0;
    this.tripped = false;
  }

  /**
   * Record a failed compaction
   */
  onFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.maxFailures) {
      this.tripped = true;
    }
  }

  /**
   * Check if compaction should be attempted
   */
  get canAttempt(): boolean {
    return !this.tripped;
  }

  /**
   * Check if breaker is tripped
   */
  get isTripped(): boolean {
    return this.tripped;
  }

  /**
   * Force reset the breaker
   */
  reset(): void {
    this.consecutiveFailures = 0;
    this.tripped = false;
  }
}
