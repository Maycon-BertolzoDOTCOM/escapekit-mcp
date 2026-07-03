/**
 * Hook System Types
 *
 * Defines the hook event types, handler interfaces, and result contracts
 * for the EscapeKit hook system.
 *
 * Inspired by Claude Code's 26 hook events × 4 types pattern.
 *
 * Usage:
 *   import { type HookEvent, type HookHandler } from './hooks/types.js'
 *
 *   const handler: HookHandler = async (ctx) => {
 *     console.log(`Hook ${ctx.event} fired`)
 *     return { continue: true }
 *   }
 */

/**
 * Supported hook events.
 *
 * Naming convention: Pre/Post + PhaseName
 */
export type HookEvent =
  | 'PreAnalysis'       // Before CodeAnalyzer.analyze()
  | 'PostAnalysis'      // After CodeAnalyzer.analyze()
  | 'PreTransform'      // Before ASTTransformer.transform()
  | 'PostTransform'     // After ASTTransformer.transform()
  | 'PreValidation'     // Before ValidationEngine.validate()
  | 'PostValidation'    // After ValidationEngine.validate()
  | 'PreGeneration'     // Before project generation
  | 'PostGeneration'    // After project generation
  | 'SessionStart'      // When session starts
  | 'SessionEnd';       // When session ends

/**
 * Context passed to hook handlers
 */
export interface HookContext {
  /** Which event triggered this hook */
  event: HookEvent;
  /** When the hook fired */
  timestamp: number;
  /** Optional input data (varies by event) */
  input?: unknown;
  /** Optional output data (Post* events) */
  output?: unknown;
  /** AbortController — handler can abort the parent operation */
  abortController: AbortController;
  /** Arbitrary metadata from the caller */
  meta?: Record<string, unknown>;
}

/**
 * Result returned by hook handlers
 */
export interface HookResult {
  /** Whether the parent operation should continue (default: true) */
  continue: boolean;
  /** Optional error message if continue=false */
  message?: string;
  /** Optional data returned by the hook */
  data?: unknown;
  /** Optional transformed input/output (for Pre* hooks that modify data) */
  transformed?: unknown;
}

/**
 * Hook handler function signature
 */
export type HookHandler = (ctx: HookContext) => Promise<HookResult> | HookResult;

/**
 * Registered hook descriptor
 */
export interface HookRegistration {
  /** Unique registration ID */
  id: string;
  /** Event this hook listens to */
  event: HookEvent;
  /** Handler function */
  handler: HookHandler;
  /** Optional human-readable name for logging */
  name?: string;
  /** Priority — lower runs first (default: 100) */
  priority: number;
}

/**
 * Result of executing all hooks for an event
 */
export interface HookExecutionResult {
  /** Event that was executed */
  event: HookEvent;
  /** Number of hooks that ran */
  hooksExecuted: number;
  /** Whether any hook blocked continuation */
  blocked: boolean;
  /** Blocking hook message (if blocked) */
  blockMessage?: string;
  /** Duration in ms */
  durationMs: number;
  /** Individual hook results */
  results: Array<{
    id: string;
    name: string;
    result: HookResult;
    durationMs: number;
  }>;
}
