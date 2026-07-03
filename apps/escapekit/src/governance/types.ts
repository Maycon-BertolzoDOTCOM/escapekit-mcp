/**
 * CodeMemória Governance — Core Types
 *
 * @module governance/types
 */

import type { ValidationResult } from '../validate/types.js';

export type { ValidationResult };

/** Nível de risco do código analisado */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** Modo de execução do GovernanceEngine */
export type GovernanceStrategy = 'fast' | 'thorough' | 'compliance-first';

/**
 * Identifica unicamente um trecho de código.
 * - complexity deve ser >= 0 (complexidade ciclomática)
 */
export interface CodeFingerprint {
  /** SHA-256 do código-fonte */
  hash: string;
  /** String derivada da estrutura AST */
  astSignature: string;
  /** Lista de dependências detectadas */
  dependencies: string[];
  /** Complexidade ciclomática estimada (inteiro >= 0) */
  complexity: number;
}

/**
 * Selo de conformidade emitido após verificação de um contrato YAML.
 * - score deve estar em [0, 1]
 */
export interface ComplianceStamp {
  /** Identificador do contrato/regulação */
  regulationId: string;
  /** Cláusulas verificadas */
  clauses: string[];
  /** Proporção de cláusulas satisfeitas [0, 1] */
  score: number;
  verifiedAt: Date;
  /** Identificador do componente verificador */
  verifiedBy: string;
}

/** Entrada imutável na cadeia de auditoria */
export interface AuditTrail {
  /** SHA-256 desta entrada */
  chainHash: string;
  /** null para a primeira entrada da cadeia */
  parentHash: string | null;
  timestamp: Date;
  action: string;
  actor: string;
  /** SHA-256 do input da ação */
  inputHash: string;
  /** SHA-256 do resultado da ação */
  resultHash: string;
}

/** Evento de entrada para o AuditLogger */
export interface AuditEvent {
  passportId: string;
  action: string;
  actor: string;
  inputHash: string;
  resultHash: string;
}

/** Documento imutável gerado para cada execução de governança */
export interface GovernancePassport {
  /** UUID v4 único */
  passportId: string;
  codeFingerprint: CodeFingerprint;
  /** Resultados do ValidationEngine */
  validations: ValidationResult[];
  complianceStamps: ComplianceStamp[];
  auditTrail: AuditTrail[];
  /** true se recall() retornou passaportes similares */
  memoryEnriched: boolean;
  riskLevel: RiskLevel;
  /** Custo estimado de remediação em horas (>= 0) */
  estimatedRemediationCost: number;
  /** Origem do resultado de validação neste passaporte */
  cacheSource?: 'engram' | 'vector' | 'full';
}

/** Identifica a ferramenta de IA que gerou o código */
export type GovernanceOrigin =
  | 'copilot' | 'claude' | 'bolt' | 'cursor' | 'unknown'
  | 'antigravity' | 'gemini' | 'gpt' | 'mistral' | 'v0' | 'lovable';

/** Estrutura de entrada do GovernanceEngine */
export interface GovernanceContext {
  code: string;
  origin: GovernanceOrigin;
  projectId: string;
  /** IDs de contratos/regulações a verificar */
  requirements: string[];
  /** Padrão: 'thorough' */
  strategy?: GovernanceStrategy;
  actor: string;
  /** Se true, ignora cache de ValidationResult e força revalidação completa */
  noCache?: boolean;
}

/** Configuração do servidor federado para createGovernanceStack() */
export interface FederatedServerConfig {
  url: string;
  sharePatterns?: boolean;
  epsilon?: number;
  noiseType?: NoiseType;
  sector?: string;
  pullTimeout?: number;
  pushTimeout?: number;
}

/** Opções de inicialização da factory createGovernanceStack() */
export interface GovernanceStackOptions {
  /** Padrão: './governance.db' */
  sqlitePath?: string;
  /** Padrão: './contracts' */
  contractsDir?: string;
  /** Padrão: './audit-logs' */
  auditLogsDir?: string;
  /** Padrão: false */
  enableChroma?: boolean;
  /** Configuração do servidor federado; se definida, usa FederatedMemoryAdapter */
  federatedServer?: FederatedServerConfig;
}

/** Padrão agregado retornado pelo FederatedMemoryServer */
export interface FederatedPattern {
  pattern_id: string;           // UUID
  confidence: number;           // [0, 1]
  rules_applied: string[];      // ex: ['LGPD-art13', 'OWASP-A01']
  success_rate: number;         // [0, 1]
}

/** Payload enviado ao servidor no POST /push */
export interface PushPayload {
  embedding: number[];          // 384 floats com ruído DP
  rule_type: string;
  success_count: number;        // >= 1
  sector?: string;
}

export type NoiseType = 'laplace' | 'gaussian';

/** Opções de inicialização do FederatedMemoryAdapter */
export interface FederatedMemoryOptions {
  sqlitePath: string;
  enableChroma?: boolean;
  serverUrl: string;
  sharePatterns?: boolean;     // padrão: true
  epsilon?: number;            // padrão: 1.0, deve ser > 0
  noiseType?: NoiseType;       // padrão: 'laplace'
  sector?: string;
  pullTimeout?: number;        // ms, padrão: 3000
  pushTimeout?: number;        // ms, padrão: 5000
}

/**
 * Métricas acumuladas de hit/miss por nível de cache do Engram Cache.
 *
 * Cada nível (engram, vector, federated) mantém contadores independentes.
 * Os hit rates são calculados como `hits / (hits + misses)`, ou `0` quando
 * nenhuma consulta foi realizada naquele nível.
 *
 * @see FederatedMemoryAdapter.getMetrics
 * @see GovernanceEngine.getCacheMetrics
 */
export interface CacheMetrics {
  /** Número de consultas resolvidas pelo EngramCache (hash exato) */
  engramHits: number;
  /** Número de consultas não resolvidas pelo EngramCache */
  engramMisses: number;
  /** Proporção de hits no nível engram: `engramHits / (engramHits + engramMisses)` ou `0` */
  engramHitRate: number;

  /** Número de consultas resolvidas pela busca vetorial local */
  vectorHits: number;
  /** Número de consultas não resolvidas pela busca vetorial local */
  vectorMisses: number;
  /** Proporção de hits no nível vetorial: `vectorHits / (vectorHits + vectorMisses)` ou `0` */
  vectorHitRate: number;

  /** Número de consultas resolvidas pelo servidor federado */
  federatedHits: number;
  /** Número de consultas não resolvidas pelo servidor federado */
  federatedMisses: number;
  /** Proporção de hits no nível federado: `federatedHits / (federatedHits + federatedMisses)` ou `0` */
  federatedHitRate: number;
}

/**
 * Payload enviado ao servidor Python via `POST /stats/client-metrics`.
 *
 * Todos os campos representam hit rates e devem estar no intervalo `[0, 1]`.
 * O servidor rejeita valores fora desse intervalo com HTTP 422.
 *
 * @see CacheMetrics
 */
export interface ClientMetricsPayload {
  /** Hit rate do nível engram, valor em `[0, 1]` */
  engramHitRate: number;
  /** Hit rate do nível vetorial, valor em `[0, 1]` */
  vectorHitRate: number;
  /** Hit rate do nível federado, valor em `[0, 1]` */
  federatedHitRate: number;
  /** Número de vezes que o ValidationResult foi servido do cache */
  validationCacheHits?: number;
  /** Número de vezes que validationEngine.validate() foi chamado */
  validationCacheMisses?: number;
  /** Média aritmética dos tempos de execução de validate() em ms */
  avgValidationTimeMs?: number;
}

/**
 * Métricas de eficiência do cache de ValidationResult.
 * Expostas via GovernanceEngine.getValidationCacheMetrics().
 */
export interface ValidationCacheMetrics {
  /** Número de vezes que o ValidationResult foi servido do cache */
  validation_cache_hits: number;
  /** Número de vezes que validationEngine.validate() foi chamado */
  validation_cache_misses: number;
  /** Média aritmética dos tempos de execução de validate() em ms */
  avg_validation_time_ms: number;
  /** Estimativa de tokens economizados: hits * avg_time_ms * 0.1 */
  tokens_saved_estimate: number;
}
