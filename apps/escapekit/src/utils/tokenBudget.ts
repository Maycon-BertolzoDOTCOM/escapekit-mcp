/**
 * Token Budget — Continuation management with diminishing returns detection.
 *
 * Detects when a generator/LLM is producing diminishing returns and stops
 * automatically, preventing wasted tokens on low-quality tail output.
 *
 * Inspired by Claude Code's query/tokenBudget.ts.
 *
 * Usage:
 *   import { TokenBudget } from './utils/tokenBudget.js'
 *
 *   const budget = new TokenBudget({
 *     maxTokensPerTurn: 64000,
 *     diminishingThreshold: 500,
 *     minContinuationsBeforeCheck: 3,
 *   })
 *
 *   // After each generation turn:
 *   const decision = budget.recordTurn(outputTokens)
 *   if (decision.type === 'stop') {
 *     console.log(`Stopped: ${decision.reason}`) // 'budget_exhausted' | 'diminishing_returns'
 *   }
 */

export type BudgetDecision =
  | { type: 'continue'; remainingTokens: number; continuationCount: number }
  | { type: 'stop'; reason: 'budget_exhausted' | 'diminishing_returns'; metadata: BudgetMetadata };

export interface BudgetMetadata {
  totalTokensUsed: number;
  continuationCount: number;
  lastDeltaTokens: number;
  diminishingReturns: boolean;
  durationMs: number;
}

export interface TokenBudgetOptions {
  /** Max tokens allowed per turn cycle (default: 64000) */
  maxTokensPerTurn?: number;
  /** Token threshold for diminishing returns (default: 500) */
  diminishingThreshold?: number;
  /** Minimum continuations before checking diminishing returns (default: 3) */
  minContinuationsBeforeCheck?: number;
}

export class TokenBudget {
  private maxTokens: number;
  private diminishingThreshold: number;
  private minContinuations: number;

  private totalUsed = 0;
  private continuationCount = 0;
  private lastDelta = 0;
  private startTime = Date.now();

  constructor(options: TokenBudgetOptions = {}) {
    this.maxTokens = options.maxTokensPerTurn ?? 64000;
    this.diminishingThreshold = options.diminishingThreshold ?? 500;
    this.minContinuations = options.minContinuationsBeforeCheck ?? 3;
  }

  /**
   * Record a generation turn and decide whether to continue
   */
  recordTurn(outputTokens: number): BudgetDecision {
    this.totalUsed += outputTokens;
    this.continuationCount++;

    // Check budget exhaustion first
    if (this.totalUsed >= this.maxTokens) {
      return {
        type: 'stop',
        reason: 'budget_exhausted',
        metadata: this.getMetadata(true),
      };
    }

    // Check diminishing returns
    if (this.isDiminishing(outputTokens)) {
      return {
        type: 'stop',
        reason: 'diminishing_returns',
        metadata: this.getMetadata(true),
      };
    }

    this.lastDelta = outputTokens;

    return {
      type: 'continue',
      remainingTokens: this.maxTokens - this.totalUsed,
      continuationCount: this.continuationCount,
    };
  }

  /**
   * Check if output is showing diminishing returns
   */
  private isDiminishing(currentDelta: number): boolean {
    if (this.continuationCount < this.minContinuations) return false;

    // Two consecutive small outputs = diminishing
    const currentSmall = currentDelta < this.diminishingThreshold;
    const lastSmall = this.lastDelta < this.diminishingThreshold;
    return currentSmall && lastSmall;
  }

  /**
   * Get current metadata
   */
  getMetadata(diminishingReturns = false): BudgetMetadata {
    return {
      totalTokensUsed: this.totalUsed,
      continuationCount: this.continuationCount,
      lastDeltaTokens: this.lastDelta,
      diminishingReturns,
      durationMs: Date.now() - this.startTime,
    };
  }

  /**
   * Get remaining token budget
   */
  get remaining(): number {
    return Math.max(0, this.maxTokens - this.totalUsed);
  }

  /**
   * Get usage percentage
   */
  get usagePercent(): number {
    return Math.round((this.totalUsed / this.maxTokens) * 100);
  }

  /**
   * Reset the budget
   */
  reset(): void {
    this.totalUsed = 0;
    this.continuationCount = 0;
    this.lastDelta = 0;
    this.startTime = Date.now();
  }
}
