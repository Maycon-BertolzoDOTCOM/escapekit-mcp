/**
 * CodeMemória Governance — HybridMemoryAdapter
 *
 * Persiste GovernancePassports em SQLite (better-sqlite3) e opcionalmente
 * usa Chroma para busca semântica. Se Chroma não estiver disponível, opera
 * exclusivamente com SQLite sem lançar exceção.
 *
 * @module governance/adapters/HybridMemoryAdapter
 */

import type { IHybridMemory } from '../interfaces.js';
import type { GovernancePassport, CodeFingerprint, ComplianceStamp, AuditTrail } from '../types.js';
import { DuplicatePassportError } from '../errors.js';
import { computeSimilarity } from '../utils/fingerprint.js';

/** Linha retornada pelo SQLite */
interface PassportRow {
  id: string;
  fingerprint_hash: string;
  risk_level: string;
  passport_json: string;
  created_at: string;
}

/** Estrutura JSON serializada do passaporte (datas como ISO strings) */
interface PassportJson {
  passportId: string;
  codeFingerprint: {
    hash: string;
    astSignature: string;
    dependencies: string[];
    complexity: number;
  };
  validations: unknown[];
  complianceStamps: Array<{
    regulationId: string;
    clauses: string[];
    score: number;
    verifiedAt: string;
    verifiedBy: string;
  }>;
  auditTrail: Array<{
    chainHash: string;
    parentHash: string | null;
    timestamp: string;
    action: string;
    actor: string;
    inputHash: string;
    resultHash: string;
  }>;
  memoryEnriched: boolean;
  riskLevel: string;
  estimatedRemediationCost: number;
  cacheSource?: string;
}

/** Desserializa um PassportJson de volta para GovernancePassport (converte datas) */
function deserializePassport(json: PassportJson): GovernancePassport {
  return {
    passportId: json.passportId,
    codeFingerprint: json.codeFingerprint,
    validations: json.validations as GovernancePassport['validations'],
    complianceStamps: json.complianceStamps.map(
      (s): ComplianceStamp => ({
        regulationId: s.regulationId,
        clauses: s.clauses,
        score: s.score,
        verifiedAt: new Date(s.verifiedAt),
        verifiedBy: s.verifiedBy,
      }),
    ),
    auditTrail: json.auditTrail.map(
      (t): AuditTrail => ({
        chainHash: t.chainHash,
        parentHash: t.parentHash,
        timestamp: new Date(t.timestamp),
        action: t.action,
        actor: t.actor,
        inputHash: t.inputHash,
        resultHash: t.resultHash,
      }),
    ),
    memoryEnriched: json.memoryEnriched,
    riskLevel: json.riskLevel as GovernancePassport['riskLevel'],
    estimatedRemediationCost: json.estimatedRemediationCost,
    cacheSource: (json.cacheSource as 'engram' | 'vector' | 'full' | undefined) ?? 'full',
  };
}

export interface HybridMemoryOptions {
  sqlitePath: string;
  enableChroma?: boolean;
}

export class HybridMemoryAdapter implements IHybridMemory {
  private db: import('better-sqlite3').Database;

  constructor(options: HybridMemoryOptions) {
    // Importação síncrona do better-sqlite3
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as typeof import('better-sqlite3');
    this.db = new Database(options.sqlitePath);
    this._initSchema();

    if (options.enableChroma) {
      this._tryInitChroma();
    }
  }

  /** Cria tabela e índice se não existirem */
  private _initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS governance_passports (
        id               TEXT PRIMARY KEY,
        fingerprint_hash TEXT NOT NULL,
        risk_level       TEXT NOT NULL,
        passport_json    TEXT NOT NULL,
        created_at       TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_fingerprint_hash
        ON governance_passports(fingerprint_hash);
    `);
  }

  /** Tenta inicializar Chroma dinamicamente; falha silenciosamente */
  private _tryInitChroma(): void {
    try {
      // Importação dinâmica — se chromadb não estiver instalado, cai no catch
      require('chromadb');
    } catch {
      console.warn(
        '[HybridMemoryAdapter] chromadb não disponível — operando apenas com SQLite.',
      );
    }
  }

  async save(passport: GovernancePassport): Promise<void> {
    const json = JSON.stringify(passport);

    const stmt = this.db.prepare(`
      INSERT INTO governance_passports (id, fingerprint_hash, risk_level, passport_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(
        passport.passportId,
        passport.codeFingerprint.hash,
        passport.riskLevel,
        json,
        new Date().toISOString(),
      );
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('UNIQUE constraint failed') || msg.includes('SQLITE_CONSTRAINT')) {
        throw new DuplicatePassportError(
          `Passaporte com id "${passport.passportId}" já existe na base de dados.`,
        );
      }
      throw err;
    }
  }

  async recallExact(fingerprint: CodeFingerprint): Promise<GovernancePassport[]> {
    const rows = this.db
      .prepare('SELECT * FROM governance_passports WHERE fingerprint_hash = ?')
      .all(fingerprint.hash) as PassportRow[];

    return rows.map((row) => deserializePassport(JSON.parse(row.passport_json) as PassportJson));
  }

  async recall(fingerprint: CodeFingerprint, threshold: number): Promise<GovernancePassport[]> {
    const rows = this.db
      .prepare('SELECT * FROM governance_passports')
      .all() as PassportRow[];

    const results: GovernancePassport[] = [];

    for (const row of rows) {
      const parsed = JSON.parse(row.passport_json) as PassportJson;
      const passport = deserializePassport(parsed);
      const similarity = computeSimilarity(fingerprint, passport.codeFingerprint);
      if (similarity >= threshold) {
        results.push(passport);
      }
    }

    return results;
  }

  async getSuccessRate(fingerprint: CodeFingerprint): Promise<number> {
    const rows = this.db
      .prepare('SELECT risk_level FROM governance_passports WHERE fingerprint_hash = ?')
      .all(fingerprint.hash) as Array<{ risk_level: string }>;

    if (rows.length === 0) {
      return 0.0;
    }

    const lowCount = rows.filter((r) => r.risk_level === 'low').length;
    return lowCount / rows.length;
  }
}
