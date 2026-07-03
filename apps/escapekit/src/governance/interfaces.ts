/**
 * CodeMemória Governance — Public Interfaces
 *
 * @module governance/interfaces
 */

import type {
  GovernanceContext,
  GovernancePassport,
  CodeFingerprint,
  ComplianceStamp,
  AuditEvent,
  AuditTrail,
  RiskLevel,
} from './types.js';

import type { Issue } from '../validate/types.js';

export interface IGovernanceEngine {
  govern(context: GovernanceContext): Promise<GovernancePassport>;
  recallSimilar(fingerprint: CodeFingerprint): Promise<GovernancePassport[]>;
}

export interface IHybridMemory {
  save(passport: GovernancePassport): Promise<void>;
  recall(fingerprint: CodeFingerprint, threshold: number): Promise<GovernancePassport[]>;
  recallExact?(fingerprint: CodeFingerprint): Promise<GovernancePassport[]>;
  getSuccessRate(fingerprint: CodeFingerprint): Promise<number>;
}

export interface IComplianceChecker {
  check(code: string, requirements: string[]): Promise<ComplianceStamp[]>;
  loadContract(contractPath: string): Promise<void>;
}

export interface IAuditLogger {
  log(event: AuditEvent): Promise<AuditTrail>;
  getChain(passportId: string): Promise<AuditTrail[]>;
  verifyIntegrity(passportId: string): Promise<boolean>;
}


/** Resultado de uma ação corretiva executada */
export interface CorrectiveActionResult {
  actionType: 'pull_request' | 'issue' | 'notification';
  success: boolean;
  resourceUrl?: string;
  error?: string;
  timestamp: Date;
  auditRef?: string;
}

/** Configuração de ação corretiva por nível de risco */
export interface CorrectiveActionConfig {
  riskLevel: RiskLevel;
  actionType: 'pull_request' | 'issue' | 'notification';
  enabled: boolean;
  template?: string;
  destination?: string;
}

/** Interface para execução de ações corretivas automáticas */
export interface ICorrectiveAction {
  execute(
    passport: GovernancePassport,
    issues: Issue[],
    config: CorrectiveActionConfig[],
  ): Promise<CorrectiveActionResult[]>;

  healthCheck(): Promise<boolean>;
}
