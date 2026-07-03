/**
 * CodeMemória Governance — FederatedMemoryAdapter
 *
 * Implements IHybridMemory by composing HybridMemoryAdapter as local cache
 * and orchestrating federated pull/push with a remote FederatedMemoryServer.
 *
 * @module governance/adapters/FederatedMemoryAdapter
 */

import { v4 as uuidv4 } from 'uuid';
import type { IHybridMemory } from '../interfaces.js';
import type {
  GovernancePassport,
  CodeFingerprint,
  FederatedPattern,
  PushPayload,
  FederatedMemoryOptions,
  CacheMetrics,
  ClientMetricsPayload,
} from '../types.js';
import { FederatedResponseParseError } from '../errors.js';
import { HybridMemoryAdapter } from './HybridMemoryAdapter.js';
import { EmbeddingGenerator } from '../utils/embedding.js';
import { DifferentialPrivacy } from '../utils/privacy.js';
import { CircuitBreaker } from '../../utils/circuitBreaker.js';

/**
 * Deserializes a JSON string into a FederatedPattern, validating required fields.
 *
 * @throws FederatedResponseParseError if JSON is malformed or fields are invalid
 */
export function deserializeFederatedPattern(json: string): FederatedPattern {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new FederatedResponseParseError(
      `Failed to parse FederatedPattern JSON: ${(err as Error).message}`,
      err,
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new FederatedResponseParseError(
      'FederatedPattern must be a JSON object',
    );
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj['pattern_id'] !== 'string') {
    throw new FederatedResponseParseError(
      'FederatedPattern missing or invalid field: pattern_id (must be string)',
    );
  }

  if (
    typeof obj['confidence'] !== 'number' ||
    obj['confidence'] < 0 ||
    obj['confidence'] > 1
  ) {
    throw new FederatedResponseParseError(
      'FederatedPattern missing or invalid field: confidence (must be number in [0, 1])',
    );
  }

  if (!Array.isArray(obj['rules_applied'])) {
    throw new FederatedResponseParseError(
      'FederatedPattern missing or invalid field: rules_applied (must be array)',
    );
  }

  if (
    typeof obj['success_rate'] !== 'number' ||
    obj['success_rate'] < 0 ||
    obj['success_rate'] > 1
  ) {
    throw new FederatedResponseParseError(
      'FederatedPattern missing or invalid field: success_rate (must be number in [0, 1])',
    );
  }

  return {
    pattern_id: obj['pattern_id'] as string,
    confidence: obj['confidence'] as number,
    rules_applied: obj['rules_applied'] as string[],
    success_rate: obj['success_rate'] as number,
  };
}

/** Converts a FederatedPattern into a synthetic GovernancePassport */
function toSyntheticPassport(
  _pattern: FederatedPattern,
  fingerprint: CodeFingerprint,
): GovernancePassport {
  return {
    passportId: uuidv4(),
    codeFingerprint: fingerprint,
    validations: [],
    complianceStamps: [],
    auditTrail: [],
    memoryEnriched: true,
    riskLevel: 'low',
    estimatedRemediationCost: 0,
  };
}

export class FederatedMemoryAdapter implements IHybridMemory {
  readonly sharePatterns: boolean;

  private readonly localCache: HybridMemoryAdapter;
  private readonly embeddingGenerator: EmbeddingGenerator;
  private readonly differentialPrivacy: DifferentialPrivacy;
  private readonly serverUrl: string;
  private readonly epsilon: number;
  private readonly noiseType: 'laplace' | 'gaussian';
  private readonly sector?: string;
  private readonly pullTimeout: number;
  private readonly pushTimeout: number;
  private readonly circuitBreaker: CircuitBreaker;

  // Contadores de métricas por nível de cache (Requisito 2.1)
  _engramHits = 0;
  _engramMisses = 0;
  _vectorHits = 0;
  _vectorMisses = 0;
  _federatedHits = 0;
  _federatedMisses = 0;

  constructor(options: FederatedMemoryOptions) {
    this.sharePatterns = options.sharePatterns ?? true;
    this.serverUrl = options.serverUrl;
    this.epsilon = options.epsilon ?? 1.0;
    this.noiseType = options.noiseType ?? 'laplace';
    this.sector = options.sector;
    this.pullTimeout = options.pullTimeout ?? 3000;
    this.pushTimeout = options.pushTimeout ?? 5000;

    this.circuitBreaker = new CircuitBreaker('federated-memory', {
      failureThreshold: 5,
      recoveryTimeoutMs: 60000,
      onStateChange: (_name, _from, _to) => {
        // Log circuit breaker state changes
      },
    });

    this.localCache = new HybridMemoryAdapter({
      sqlitePath: options.sqlitePath,
      enableChroma: options.enableChroma,
    });

    this.embeddingGenerator = new EmbeddingGenerator();
    this.differentialPrivacy = new DifferentialPrivacy();
  }

  /**
   * Recalls passports for a given fingerprint.
   * 1. EngramCache (O(1) hash lookup) — returns immediately on hit (Requisitos 1.4, 1.5).
   * 2. Vector similarity search in LocalCache — returns on hit (Requisito 1.6).
   * 3. On vector miss: queries FederatedMemoryServer via GET /query.
   * 4. Filters patterns with confidence >= 0.7, converts to synthetic passports,
   *    persists them in LocalCache, and returns them.
   * 5. Returns [] silently on timeout or HTTP >= 500 (logs warn).
   */
  async recall(fingerprint: CodeFingerprint, threshold: number): Promise<GovernancePassport[]> {
    // 1. EngramCache — O(1) lookup by exact hash (Requisitos 1.4, 1.5, 2.2, 2.3)
    const exact = await this.localCache.recallExact(fingerprint);
    if (exact.length > 0) {
      this._engramHits++;
      return exact;
    }
    this._engramMisses++;

    // 2. Vector similarity search in LocalCache (Requisito 1.6, 2.4, 2.5)
    const cached = await this.localCache.recall(fingerprint, threshold);
    if (cached.length > 0) {
      this._vectorHits++;
      return cached;
    }
    this._vectorMisses++;

    // 3. Cache miss — query federated server (Requisitos 2.6, 2.7, 4.2)
    let patterns: FederatedPattern[];
    try {
      patterns = await this._pullFromServer(fingerprint);
    } catch {
      // Errors already logged inside _pullFromServer
      this._federatedMisses++;
      return [];
    }

    // 4. Filter by confidence >= Math.fround(0.7) (float32 threshold)
    const filtered = patterns.filter((p) => p.confidence >= Math.fround(0.7));

    if (filtered.length === 0) {
      this._federatedMisses++;
      return [];
    }

    this._federatedHits++;

    // 5. Convert to synthetic passports and persist in LocalCache
    const passports: GovernancePassport[] = [];
    for (const pattern of filtered) {
      const passport = toSyntheticPassport(pattern, fingerprint);
      try {
        await this.localCache.save(passport);
      } catch {
        // Ignore duplicate or other save errors — passport still returned
      }
      passports.push(passport);
    }

    return passports;
  }

  /**
   * Saves a passport to LocalCache and optionally fires a push to the federated server.
   * Push is fire-and-forget (does not block return).
   */
  async save(passport: GovernancePassport): Promise<void> {
    // 1. Persist in LocalCache (synchronous in terms of awaiting)
    await this.localCache.save(passport);

    // 2. Fire-and-forget push if conditions are met
    if (this.sharePatterns && passport.riskLevel === 'low') {
      void this._pushToServer(passport);
    }
  }

  /**
   * Returns accumulated cache metrics with hit rates for each level.
   * Hit rates are protected against division by zero (Requisitos 2.8, 2.10).
   */
  getMetrics(): CacheMetrics {
    const engramTotal = this._engramHits + this._engramMisses;
    const vectorTotal = this._vectorHits + this._vectorMisses;
    const federatedTotal = this._federatedHits + this._federatedMisses;

    return {
      engramHits: this._engramHits,
      engramMisses: this._engramMisses,
      engramHitRate: engramTotal === 0 ? 0 : this._engramHits / engramTotal,
      vectorHits: this._vectorHits,
      vectorMisses: this._vectorMisses,
      vectorHitRate: vectorTotal === 0 ? 0 : this._vectorHits / vectorTotal,
      federatedHits: this._federatedHits,
      federatedMisses: this._federatedMisses,
      federatedHitRate: federatedTotal === 0 ? 0 : this._federatedHits / federatedTotal,
    };
  }

  /**
   * Delegates to LocalCache.
   */
  async getSuccessRate(fingerprint: CodeFingerprint): Promise<number> {
    return this.localCache.getSuccessRate(fingerprint);
  }

  /**
   * Sends client-side cache metrics (including validation cache fields) to the
   * federated server via POST /stats/client-metrics.
   *
   * Fire-and-forget: does not block the caller and silences errors with a warn log.
   * Requisito: 3.5
   */
  async pushClientMetrics(metrics: ClientMetricsPayload): Promise<void> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.pushTimeout);
      try {
        await fetch(`${this.serverUrl}/stats/client-metrics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metrics),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.warn(
          `[FederatedMemoryAdapter] POST /stats/client-metrics timed out after ${this.pushTimeout}ms`,
        );
      } else {
        console.warn(
          `[FederatedMemoryAdapter] POST /stats/client-metrics failed: ${(err as Error).message}`,
        );
      }
    }
  }

  /** Queries the federated server for patterns similar to the given fingerprint. */
  private async _pullFromServer(fingerprint: CodeFingerprint): Promise<FederatedPattern[]> {
    // Circuit breaker — fail fast if server is down
    if (!this.circuitBreaker.canExecute()) {
      console.warn('[FederatedMemoryAdapter] Circuit open, skipping pull');
      this._federatedMisses++;
      return [];
    }

    return this.circuitBreaker.execute(async () => {
      const embedding = this.embeddingGenerator.generate(fingerprint);
      const embeddingJson = JSON.stringify(Array.from(embedding));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.pullTimeout);

      try {
        const url = `${this.serverUrl}/query?embedding=${encodeURIComponent(embeddingJson)}&limit=5`;
        const response = await fetch(url, { signal: controller.signal });

        if (response.status >= 500) {
          throw new Error(`Server error: HTTP ${response.status}`);
        }

        const text = await response.text();
        let rawList: unknown;
        try {
          rawList = JSON.parse(text);
        } catch (err) {
          throw new FederatedResponseParseError(
            `Failed to parse /query response: ${(err as Error).message}`,
            err,
          );
        }

        if (!Array.isArray(rawList)) {
          throw new FederatedResponseParseError('/query response must be a JSON array');
        }

        return rawList.map((item) => deserializeFederatedPattern(JSON.stringify(item)));
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          console.warn(
            `[FederatedMemoryAdapter] GET /query timed out after ${this.pullTimeout}ms`,
          );
          return [];
        }
        if (err instanceof FederatedResponseParseError) {
          throw err;
        }
        console.warn(`[FederatedMemoryAdapter] GET /query failed: ${(err as Error).message}`);
        return [];
      } finally {
        clearTimeout(timer);
      }
    });
  }

  /** Sends a push payload to the federated server (fire-and-forget). */
  private async _pushToServer(passport: GovernancePassport): Promise<void> {
    try {
      const embedding = this.embeddingGenerator.generate(passport.codeFingerprint);
      const noisyEmbedding = this.differentialPrivacy.addNoise(
        embedding,
        this.epsilon,
        this.noiseType,
      );

      const payload: PushPayload = {
        embedding: Array.from(noisyEmbedding),
        rule_type: passport.complianceStamps[0]?.regulationId ?? 'unknown',
        success_count: 1,
        ...(this.sector !== undefined ? { sector: this.sector } : {}),
      };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.pushTimeout);

      try {
        await fetch(`${this.serverUrl}/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.warn(
          `[FederatedMemoryAdapter] POST /push timed out after ${this.pushTimeout}ms`,
        );
      } else {
        console.warn(`[FederatedMemoryAdapter] POST /push failed: ${(err as Error).message}`);
      }
    }
  }
}
