/**
 * CodeMemória Governance — Public API
 *
 * Factory `createGovernanceStack()` e exportações públicas da camada de governança.
 * Não reexporta internals dos adaptadores.
 *
 * @module governance
 */

import { AuditLoggerAdapter } from './adapters/AuditLoggerAdapter.js';
import { HybridMemoryAdapter } from './adapters/HybridMemoryAdapter.js';
import { FederatedMemoryAdapter } from './adapters/FederatedMemoryAdapter.js';
import { ComplianceCheckerAdapter } from './adapters/ComplianceCheckerAdapter.js';
import { GovernanceEngine } from './GovernanceEngine.js';
import { GovernanceInitError } from './errors.js';
import type { IValidationEngine } from './GovernanceEngine.js';
import type { IGovernanceEngine, IHybridMemory, IComplianceChecker, IAuditLogger } from './interfaces.js';
import type { GovernanceStackOptions } from './types.js';

// ─── Re-exportações públicas ────────────────────────────────────────────────

// Interfaces
export type { IGovernanceEngine, IHybridMemory, IComplianceChecker, IAuditLogger };

// Adaptadores
export { FederatedMemoryAdapter } from './adapters/FederatedMemoryAdapter.js';

// Tipos de entidade
export type {
  GovernancePassport,
  CodeFingerprint,
  ComplianceStamp,
  AuditTrail,
  AuditEvent,
  GovernanceContext,
  GovernanceStackOptions,
  RiskLevel,
  GovernanceStrategy,
  GovernanceOrigin,
  FederatedMemoryOptions,
  FederatedPattern,
  FederatedServerConfig,
} from './types.js';

// Erros
export {
  GovernanceError,
  GovernanceValidationError,
  GovernanceInitError,
  AuditWriteError,
  DuplicatePassportError,
  InvalidPrivacyParameterError,
  FederatedResponseParseError,
} from './errors.js';

// ─── Resultado da factory ────────────────────────────────────────────────────

export interface GovernanceStack {
  engine: IGovernanceEngine;
  memory: IHybridMemory;
  compliance: IComplianceChecker;
  audit: IAuditLogger;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Inicializa toda a pilha de governança com uma única chamada.
 *
 * O `validationEngine` é obrigatório: deve ser uma instância compatível com
 * `IValidationEngine` (ex.: `new ValidationEngine()` do EscapeKit, ou um mock).
 * A factory não instancia o ValidationEngine internamente para evitar acoplamento
 * e garantir que o consumidor controle o ciclo de vida do engine existente.
 *
 * Ordem de inicialização: AuditLoggerAdapter → HybridMemoryAdapter →
 * ComplianceCheckerAdapter → GovernanceEngine
 *
 * @param validationEngine - Instância do ValidationEngine (ou compatível)
 * @param options - Opções de configuração (todas opcionais)
 * @returns Pilha de governança inicializada
 * @throws {GovernanceInitError} Se qualquer adaptador falhar na inicialização
 */
export function createGovernanceStack(
  validationEngine: IValidationEngine,
  options?: GovernanceStackOptions,
): GovernanceStack {
  const sqlitePath = options?.sqlitePath ?? './governance.db';
  const contractsDir = options?.contractsDir ?? './contracts';
  const auditLogsDir = options?.auditLogsDir ?? './audit-logs';
  const enableChroma = options?.enableChroma ?? false;

  // 1. AuditLoggerAdapter
  let audit: IAuditLogger;
  try {
    audit = new AuditLoggerAdapter(auditLogsDir);
  } catch (err) {
    throw new GovernanceInitError(
      `Falha ao inicializar AuditLoggerAdapter (auditLogsDir="${auditLogsDir}"): ${(err as Error).message}`,
    );
  }

  // 2. Memory adapter — FederatedMemoryAdapter ou HybridMemoryAdapter
  let memory: IHybridMemory;
  if (options?.federatedServer?.url) {
    const fed = options.federatedServer;
    try {
      memory = new FederatedMemoryAdapter({
        sqlitePath,
        enableChroma,
        serverUrl: fed.url,
        sharePatterns: fed.sharePatterns,
        epsilon: fed.epsilon,
        noiseType: fed.noiseType,
        sector: fed.sector,
        pullTimeout: fed.pullTimeout,
        pushTimeout: fed.pushTimeout,
      });
    } catch (err) {
      throw new GovernanceInitError(
        `Falha ao inicializar FederatedMemoryAdapter (serverUrl="${fed.url}"): ${(err as Error).message}`,
      );
    }
  } else {
    try {
      memory = new HybridMemoryAdapter({ sqlitePath, enableChroma });
    } catch (err) {
      // Se enableChroma causou a falha, tenta novamente sem Chroma
      if (enableChroma) {
        console.warn(
          `[createGovernanceStack] Falha ao inicializar HybridMemoryAdapter com Chroma — tentando apenas SQLite. Erro: ${(err as Error).message}`,
        );
        try {
          memory = new HybridMemoryAdapter({ sqlitePath, enableChroma: false });
        } catch (fallbackErr) {
          throw new GovernanceInitError(
            `Falha ao inicializar HybridMemoryAdapter (sqlitePath="${sqlitePath}"): ${(fallbackErr as Error).message}`,
          );
        }
      } else {
        throw new GovernanceInitError(
          `Falha ao inicializar HybridMemoryAdapter (sqlitePath="${sqlitePath}"): ${(err as Error).message}`,
        );
      }
    }
  }

  // 3. ComplianceCheckerAdapter
  let compliance: IComplianceChecker;
  try {
    compliance = new ComplianceCheckerAdapter(contractsDir);
  } catch (err) {
    throw new GovernanceInitError(
      `Falha ao inicializar ComplianceCheckerAdapter (contractsDir="${contractsDir}"): ${(err as Error).message}`,
    );
  }

  // 4. GovernanceEngine
  let engine: IGovernanceEngine;
  try {
    engine = new GovernanceEngine({ validationEngine, memory, compliance, audit });
  } catch (err) {
    throw new GovernanceInitError(
      `Falha ao inicializar GovernanceEngine: ${(err as Error).message}`,
    );
  }

  return { engine, memory, compliance, audit };
}
