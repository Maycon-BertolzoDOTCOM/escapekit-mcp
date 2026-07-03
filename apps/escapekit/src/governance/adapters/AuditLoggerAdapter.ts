/**
 * CodeMemória Governance — AuditLoggerAdapter
 *
 * Persiste cada entrada de auditoria como arquivo JSON individual em um diretório
 * configurável, mantendo uma cadeia de hashes imutável (SHA-256) para rastreabilidade.
 *
 * @module governance/adapters/AuditLoggerAdapter
 */

import * as fs from 'fs';
import * as path from 'path';
import type { IAuditLogger } from '../interfaces.js';
import type { AuditEvent, AuditTrail } from '../types.js';
import { AuditWriteError } from '../errors.js';
import { chainHash } from '../utils/hash.js';

/** Estrutura do arquivo JSON persistido (inclui passportId para filtragem) */
interface AuditTrailFile extends AuditTrail {
  passportId: string;
}

export class AuditLoggerAdapter implements IAuditLogger {
  private readonly auditLogsDir: string;
  private readonly _locks = new Map<string, Promise<void>>();

  constructor(auditLogsDir: string) {
    this.auditLogsDir = auditLogsDir;
    fs.mkdirSync(auditLogsDir, { recursive: true });
  }

  async log(event: AuditEvent): Promise<AuditTrail> {
    // Serialize concurrent log() calls for the same passportId to prevent
    // race conditions that would corrupt the hash chain (two entries with parentHash=null).
    const prev = this._locks.get(event.passportId) ?? Promise.resolve();
    let resolve!: () => void;
    const next = new Promise<void>((r) => { resolve = r; });
    this._locks.set(event.passportId, prev.then(() => next));

    await prev;
    try {
      return await this._logInternal(event);
    } finally {
      resolve();
      // Clean up lock entry if no more waiters
      if (this._locks.get(event.passportId) === prev.then(() => next)) {
        this._locks.delete(event.passportId);
      }
    }
  }

  private async _logInternal(event: AuditEvent): Promise<AuditTrail> {
    const chain = await this.getChain(event.passportId);
    const parentHash = chain.length > 0 ? chain[chain.length - 1].chainHash : null;

    const timestamp = new Date();

    const hash = chainHash(
      parentHash,
      timestamp,
      event.action,
      event.actor,
      event.inputHash,
      event.resultHash,
    );

    const trail: AuditTrail = {
      chainHash: hash,
      parentHash,
      timestamp,
      action: event.action,
      actor: event.actor,
      inputHash: event.inputHash,
      resultHash: event.resultHash,
    };

    const sanitizedTimestamp = timestamp.toISOString().replace(/:/g, '-');
    const filename = `${sanitizedTimestamp}_${hash.slice(0, 8)}.json`;
    const filepath = path.join(this.auditLogsDir, filename);

    const fileContent: AuditTrailFile = {
      ...trail,
      passportId: event.passportId,
    };

    try {
      fs.writeFileSync(filepath, JSON.stringify(fileContent, null, 2), 'utf8');
    } catch (err) {
      throw new AuditWriteError(
        `Falha ao escrever entrada de auditoria em "${filepath}": ${(err as Error).message}`,
      );
    }

    return trail;
  }

  async getChain(passportId: string): Promise<AuditTrail[]> {
    const entries = await this._readEntriesForPassport(passportId);
    return entries.map(({ passportId: _pid, ...trail }) => trail as AuditTrail);
  }

  async verifyIntegrity(passportId: string): Promise<boolean> {
    const entries = await this._readEntriesForPassport(passportId);

    if (entries.length === 0) {
      return true; // Cadeia vazia é considerada íntegra
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // Recalcula o chainHash
      const recalculated = chainHash(
        entry.parentHash,
        entry.timestamp,
        entry.action,
        entry.actor,
        entry.inputHash,
        entry.resultHash,
      );

      if (recalculated !== entry.chainHash) {
        return false;
      }

      // Verifica encadeamento: parentHash[i] deve ser chainHash[i-1]
      if (i === 0) {
        if (entry.parentHash !== null) {
          return false;
        }
      } else {
        if (entry.parentHash !== entries[i - 1].chainHash) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Lê todas as entradas do diretório para um dado passportId,
   * ordenadas pela cadeia de parentHash (ordem de inserção real).
   */
  private async _readEntriesForPassport(passportId: string): Promise<AuditTrailFile[]> {
    let files: string[];
    try {
      files = fs.readdirSync(this.auditLogsDir).filter((f) => f.endsWith('.json'));
    } catch {
      return [];
    }

    const entries: AuditTrailFile[] = [];

    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(this.auditLogsDir, file), 'utf8');
        const parsed = JSON.parse(raw) as AuditTrailFile;
        if (parsed.passportId === passportId) {
          entries.push({ ...parsed, timestamp: new Date(parsed.timestamp) });
        }
      } catch {
        // Ignora arquivos corrompidos
      }
    }

    // Ordena pela cadeia de parentHash (reconstrói a ordem de inserção)
    return this._sortByChain(entries);
  }

  /**
   * Ordena entradas pela cadeia de parentHash.
   * A primeira entrada tem parentHash === null; cada entrada subsequente
   * tem parentHash igual ao chainHash da anterior.
   */
  private _sortByChain(entries: AuditTrailFile[]): AuditTrailFile[] {
    if (entries.length <= 1) return entries;

    // Encontra a primeira entrada (parentHash === null)
    const first = entries.find((e) => e.parentHash === null);
    if (!first) {
      // Cadeia corrompida — retorna por timestamp como fallback
      return [...entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }

    const sorted: AuditTrailFile[] = [first];
    let current = first;

    while (sorted.length < entries.length) {
      // Encontra a entrada cujo parentHash é o chainHash atual
      const next = entries.find((e) => e.parentHash === current.chainHash);
      if (!next) break; // Cadeia incompleta ou corrompida
      sorted.push(next);
      current = next;
    }

    // Se não conseguiu ordenar todos (cadeia corrompida), retorna por timestamp
    if (sorted.length !== entries.length) {
      return [...entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }

    return sorted;
  }
}
