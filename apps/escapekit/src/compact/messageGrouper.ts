/**
 * API-Round Message Grouping
 *
 * Groups messages by API round-trip boundaries using assistant.message.id.
 * This is critical for single-prompt agentic sessions where one human turn
 * generates dozens of tool-use rounds.
 *
 * Inspired by Claude Code's services/compact/grouping.ts.
 *
 * Usage:
 *   import { groupByApiRound } from './compact/messageGrouper.js'
 *
 *   const groups = groupByApiRound(messages)
 *   // Each group is a safe split point for compaction
 */

import type { CompactableMessage } from './types.js';

export interface MessageGroup {
  /** Messages in this group */
  messages: CompactableMessage[];
  /** Estimated token count for the group */
  estimatedTokens: number;
  /** Whether this group contains tool use results */
  hasToolResults: boolean;
  /** Timestamp of the last message in the group */
  lastTimestamp: number;
}

/**
 * Group messages by API round-trip boundaries.
 *
 * A new group starts when an assistant message has a different id
 * than the previous assistant message. Streaming chunks from the
 * same API response share an id, so boundaries only fire at
 * genuinely new rounds.
 */
export function groupByApiRound(messages: CompactableMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let current: CompactableMessage[] = [];
  let lastAssistantId: string | undefined;

  for (const msg of messages) {
    const isNewRound =
      msg.type === 'assistant' &&
      msg.id !== lastAssistantId &&
      current.length > 0;

    if (isNewRound) {
      groups.push(buildGroup(current));
      current = [msg];
    } else {
      current.push(msg);
    }

    if (msg.type === 'assistant') {
      lastAssistantId = msg.id;
    }
  }

  if (current.length > 0) {
    groups.push(buildGroup(current));
  }

  return groups;
}

/**
 * Build a MessageGroup from a list of messages
 */
function buildGroup(messages: CompactableMessage[]): MessageGroup {
  const estimatedTokens = messages.reduce(
    (sum, m) => sum + (m.tokens ?? m.preview?.length ?? 0),
    0,
  );
  const hasToolResults = messages.some(
    (m) => m.type === 'tool_use' || m.type === 'tool_result',
  );
  const lastTimestamp = messages[messages.length - 1]?.timestamp ?? 0;

  return { messages, estimatedTokens, hasToolResults, lastTimestamp };
}

/**
 * Find safe truncation points — groups that don't contain orphaned tool_use.
 *
 * A tool_use must have a matching tool_result in the same or later group.
 * Safe truncation points are between groups where all tool_use are resolved.
 */
export function findSafeTruncationPoints(groups: MessageGroup[]): number[] {
  const safePoints: number[] = [];
  let pendingToolUses = new Set<string>();

  for (let i = 0; i < groups.length; i++) {
    for (const msg of groups[i].messages) {
      if (msg.type === 'tool_use') {
        pendingToolUses.add(msg.id);
      }
      if (msg.type === 'tool_result') {
        // tool_result.id matches tool_use.id
        pendingToolUses.delete(msg.id);
      }
    }

    // After this group, if no pending tool_use, it's a safe truncation point
    if (pendingToolUses.size === 0 && i < groups.length - 1) {
      safePoints.push(i + 1); // Can truncate before this index
    }
  }

  return safePoints;
}

/**
 * Compact by removing oldest groups (keeping tool_use/result pairs intact).
 *
 * @param groups - Message groups
 * @param maxGroups - Maximum groups to keep
 * @returns Compacted messages
 */
export function compactOldestGroups(
  groups: MessageGroup[],
  maxGroups: number,
): CompactableMessage[] {
  if (groups.length <= maxGroups) {
    return groups.flatMap((g) => g.messages);
  }

  const safePoints = findSafeTruncationPoints(groups);

  // Find the oldest safe truncation point that keeps maxGroups
  const targetStart = groups.length - maxGroups;
  const truncateAt = safePoints.find((p) => p >= targetStart) ?? targetStart;

  const kept = groups.slice(truncateAt);
  return kept.flatMap((g) => g.messages);
}
