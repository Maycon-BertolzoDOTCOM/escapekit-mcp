/**
 * Time-Based Microcompact
 *
 * When the gap since the last assistant message exceeds a threshold,
 * content-clear old tool results. The insight: the server cache has
 * expired anyway, so clearing before the request shrinks what gets rewritten.
 *
 * Inspired by Claude Code's services/compact/microCompact.ts (time-based path).
 *
 * Usage:
 *   import { timeBasedMicrocompact } from './compact/timeBasedMC.js'
 *
 *   const { messages, compacted, tokensSaved } = timeBasedMicrocompact(
 *     messages,
 *     { timeBasedThresholdMs: 3600000 }
 *   )
 */

import type { CompactableMessage, CompactConfig, CompactResult } from './types.js';

const DEFAULT_THRESHOLD_MS = 3600000; // 1 hour
const DEFAULT_CLEARED_CONTENT = '[Old tool result content cleared]';

/**
 * Check if the gap since last assistant message exceeds the threshold
 */
export function shouldTimeBasedCompact(
  messages: CompactableMessage[],
  thresholdMs: number,
): boolean {
  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.type === 'assistant');

  if (!lastAssistant) return false;

  const gap = Date.now() - lastAssistant.timestamp;
  return gap > thresholdMs;
}

/**
 * Perform time-based microcompact.
 *
 * Content-clears tool_result messages that are older than the threshold.
 * Preserves the most recent N results to maintain context.
 */
export function timeBasedMicrocompact(
  messages: CompactableMessage[],
  config: CompactConfig = {},
): CompactResult & { messages: CompactableMessage[] } {
  const startTime = Date.now();
  const thresholdMs = config.timeBasedThresholdMs ?? DEFAULT_THRESHOLD_MS;
  const clearedContent = config.clearedContent ?? DEFAULT_CLEARED_CONTENT;

  if (!shouldTimeBasedCompact(messages, thresholdMs)) {
    return {
      messages,
      compacted: 0,
      tokensSaved: 0,
      strategy: 'none',
      durationMs: Date.now() - startTime,
    };
  }

  // Find tool results to clear (keep last 5 intact)
  const toolResults = messages.filter((m) => m.type === 'tool_result');
  const toClear = toolResults.slice(0, Math.max(0, toolResults.length - 5));
  const toClearIds = new Set(toClear.map((m) => m.id));

  let tokensSaved = 0;
  let compacted = 0;

  const compactedMessages = messages.map((m) => {
    if (toClearIds.has(m.id) && m.type === 'tool_result') {
      const originalTokens = m.tokens ?? m.preview?.length ?? 0;
      tokensSaved += Math.max(0, originalTokens - clearedContent.length);
      compacted++;
      return {
        ...m,
        preview: clearedContent,
        tokens: clearedContent.length,
      };
    }
    return m;
  });

  return {
    messages: compactedMessages,
    compacted,
    tokensSaved,
    strategy: 'time_based',
    durationMs: Date.now() - startTime,
  };
}
