/**
 * CodeMemória Governance — GovernanceEngine
 *
 * Orquestrador principal que coordena ValidationEngine, HybridMemory,
 * ComplianceChecker e AuditLogger para produzir um GovernancePassport.
 *
 * @module governance/GovernanceEngine
 */

import { v4 as uuidv4 } from 'uuid';
import type { IGovernanceEngine, IHybridMemory, IComplianceChecker, IAuditLogger } from './interfaces.js';
import type {
  GovernanceContext,
  GovernancePassport,
  CodeFingerprint,
  RiskLevel,
  ComplianceStamp,
  CacheMetrics,
  ValidationCacheMetrics,
} from './types.js';
import { FederatedMemoryAdapter } from './adapters/FederatedMemoryAdapter.js';
import type { ValidationResult, Issue } from '../validate/types.js';
import { GovernanceValidationError } from './errors.js';
import { computeFingerprint } from './utils/fingerprint.js';
import { sha256 } from './utils/hash.js';

/** Interface mínima esperada do ValidationEngine (ou qualquer mock compatível) */
export interface IValidationEngine {
  validate(code: string, options?: Record<string, unknown>): Promise<ValidationResult>;
}

/** Dependências injetadas no GovernanceEngine */
export interface GovernanceEngineDeps {
  validationEngine: IValidationEngine;
  memory: IHybridMemory;
  compliance: IComplianceChecker;
  audit: IAuditLogger;
}

/**
 * Pure function — computes risk level from issues and compliance stamps.
 * Extracted for direct unit testing without GovernanceEngine mocks.
 */
export function computeRiskLevel(
  issues: Issue[],
  complianceStamps: ComplianceStamp[],
): RiskLevel {
  const hasErrors = issues.some(
    (i) => i.severity === 'error' || (i as { type?: string }).type === 'error',
  );
  if (hasErrors) return 'critical';

  const hasWarnings = issues.some((i) => i.severity === 'warning');

  if (hasWarnings) {
    const avgScore =
      complianceStamps.length > 0
        ? complianceStamps.reduce((sum, s) => sum + s.score, 0) / complianceStamps.length
        : 1.0;

    if (avgScore < 0.7) return 'high';
    return 'medium';
  }

  return 'low';
}

export class GovernanceEngine implements IGovernanceEngine {
  private readonly validationEngine: IValidationEngine;
  private readonly memory: IHybridMemory;
  private readonly compliance: IComplianceChecker;
  private readonly audit: IAuditLogger;

  private _validationCacheHits = 0;
  private _validationCacheMisses = 0;
  private _validationTimes: number[] = [];

  constructor(deps: GovernanceEngineDeps) {
    this.validationEngine = deps.validationEngine;
    this.memory = deps.memory;
    this.compliance = deps.compliance;
    this.audit = deps.audit;
  }

  async govern(context: GovernanceContext): Promise<GovernancePassport> {
    const strategy = context.strategy ?? 'thorough';

    // Computa fingerprint
    const fingerprint = computeFingerprint(context.code);

    // Valida complexity >= 0
    if (fingerprint.complexity < 0) {
      throw new GovernanceValidationError(
        `CodeFingerprint.complexity deve ser >= 0, recebido: ${fingerprint.complexity}`,
      );
    }

    let validationResult: ValidationResult | null = null;
    let complianceStamps: ComplianceStamp[] = [];
    let memoryEnriched = false;
    let cacheSource: 'engram' | 'vector' | 'full' = 'full';

    try {
      if (strategy === 'fast') {
        // fast: só fingerprint + recall da memória
        const similar = await this.memory.recall(fingerprint, 0.7);
        memoryEnriched = similar.length > 0;
        cacheSource = 'full';
      } else if (strategy === 'thorough') {
        // thorough: fingerprint + recall + validação + compliance (com cache de ValidationResult)
        const similar = await this.memory.recall(fingerprint, 0.7);
        memoryEnriched = similar.length > 0;

        if (context.noCache !== true) {
          // Tenta recuperar ValidationResult do cache via recallExact
          let cachedPassport: GovernancePassport | undefined;
          try {
            const exactMatches = await this.memory.recallExact?.(fingerprint) ?? [];
            cachedPassport = exactMatches.find((p) => p.validations.length > 0);
          } catch {
            // Captura exceções de recallExact silenciosamente — trata como miss
          }

          if (cachedPassport) {
            validationResult = cachedPassport.validations[0];
            cacheSource = 'engram';
            this._validationCacheHits++;
          } else {
            const t0 = Date.now();
            validationResult = await this.validationEngine.validate(context.code);
            this._validationTimes.push(Date.now() - t0);
            cacheSource = 'full';
            this._validationCacheMisses++;
          }
        } else {
          // noCache === true: força revalidação completa
          const t0 = Date.now();
          validationResult = await this.validationEngine.validate(context.code);
          this._validationTimes.push(Date.now() - t0);
          cacheSource = 'full';
          this._validationCacheMisses++;
        }

        complianceStamps = await this.compliance.check(context.code, context.requirements);
      } else if (strategy === 'compliance-first') {
        // compliance-first: compliance primeiro; se score médio < 0.5, interrompe
        complianceStamps = await this.compliance.check(context.code, context.requirements);
        cacheSource = 'full';

        const avgScore = complianceStamps.length > 0
          ? complianceStamps.reduce((sum, s) => sum + s.score, 0) / complianceStamps.length
          : 0;

        if (avgScore >= 0.5) {
          validationResult = await this.validationEngine.validate(context.code);
        }
        // Se avgScore < 0.5, não chama validationEngine (interrompe)
      }

      // Valida scores dos ComplianceStamps
      for (const stamp of complianceStamps) {
        if (stamp.score < 0 || stamp.score > 1) {
          throw new GovernanceValidationError(
            `ComplianceStamp.score deve estar em [0, 1], recebido: ${stamp.score} (regulationId: ${stamp.regulationId})`,
          );
        }
      }

      // Extrai issues do ValidationResult
      const issues: Issue[] = validationResult?.remainingIssues ?? [];

      // Calcula riskLevel
      const riskLevel = this._computeRiskLevel(issues, complianceStamps);

      // Calcula estimatedRemediationCost
      const estimatedRemediationCost = Math.round(issues.length * 0.5 * 10) / 10;

      // Gera passportId único
      const passportId = uuidv4();

      // Monta GovernancePassport
      const passport: GovernancePassport = {
        passportId,
        codeFingerprint: fingerprint,
        validations: validationResult ? [validationResult] : [],
        complianceStamps,
        auditTrail: [],
        memoryEnriched,
        riskLevel,
        estimatedRemediationCost,
        cacheSource,
      };

      // Salva na memória
      await this.memory.save(passport);

      // Registra no audit (SEMPRE)
      const inputHash = sha256(context.code);
      const resultHash = sha256(JSON.stringify({ passportId, riskLevel }));
      const auditTrail = await this.audit.log({
        passportId,
        action: 'govern',
        actor: context.actor,
        inputHash,
        resultHash,
      });

      passport.auditTrail = [auditTrail];

      return passport;
    } catch (err) {
      // Em caso de erro controlado (GovernanceValidationError), registra no audit antes de propagar
      if (err instanceof GovernanceValidationError) {
        try {
          const inputHash = sha256(context.code);
          const resultHash = sha256(JSON.stringify({ error: err.message }));
          await this.audit.log({
            passportId: uuidv4(),
            action: 'govern:error',
            actor: context.actor,
            inputHash,
            resultHash,
          });
        } catch {
          // Ignora falha no audit durante tratamento de erro
        }
        throw err;
      }
      throw err;
    }
  }

  async recallSimilar(fingerprint: CodeFingerprint): Promise<GovernancePassport[]> {
    return this.memory.recall(fingerprint, 0.7);
  }

  getCacheMetrics(): CacheMetrics {
    if (this.memory instanceof FederatedMemoryAdapter) {
      return this.memory.getMetrics();
    }
    return {
      engramHits: 0,
      engramMisses: 0,
      engramHitRate: 0,
      vectorHits: 0,
      vectorMisses: 0,
      vectorHitRate: 0,
      federatedHits: 0,
      federatedMisses: 0,
      federatedHitRate: 0,
    };
  }

  getValidationCacheMetrics(): ValidationCacheMetrics {
    const avg = this._validationTimes.length > 0
      ? this._validationTimes.reduce((sum, t) => sum + t, 0) / this._validationTimes.length
      : 0;
    return {
      validation_cache_hits: this._validationCacheHits,
      validation_cache_misses: this._validationCacheMisses,
      avg_validation_time_ms: avg,
      tokens_saved_estimate: this._validationCacheHits * avg * 0.1,
    };
  }

  private _computeRiskLevel(issues: Issue[], complianceStamps: ComplianceStamp[]): RiskLevel {
    return computeRiskLevel(issues, complianceStamps);
  }
}
