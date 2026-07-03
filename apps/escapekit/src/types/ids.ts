/**
 * Branded Types for IDs
 *
 * Type-safe identifiers using TypeScript's branded types pattern.
 * Prevents accidental misuse of string IDs across the system.
 *
 * Inspired by Claude Code's SessionId and AgentId branded types.
 *
 * Usage:
 *   import { createSessionId, type SessionId } from './types/ids.js'
 *
 *   const id: SessionId = createSessionId()
 *   function process(sessionId: SessionId) { ... }
 *   process('not-a-session-id')  // TypeScript error
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Session identifier — branded string to prevent mixing with other IDs
 */
export type SessionId = string & { readonly __brand: 'SessionId' };

/**
 * Operation identifier — branded string for tracking individual operations
 */
export type OperationId = string & { readonly __brand: 'OperationId' };

/**
 * Request identifier — branded string for correlating API requests
 */
export type RequestId = string & { readonly __brand: 'RequestId' };

/**
 * Create a new SessionId (UUID v4)
 */
export function createSessionId(): SessionId {
  return uuidv4() as SessionId;
}

/**
 * Create a new OperationId (UUID v4)
 */
export function createOperationId(): OperationId {
  return uuidv4() as OperationId;
}

/**
 * Create a new RequestId (UUID v4)
 */
export function createRequestId(): RequestId {
  return uuidv4() as RequestId;
}

/**
 * Check if a string is a valid branded ID (UUID format)
 */
export function isValidId(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
