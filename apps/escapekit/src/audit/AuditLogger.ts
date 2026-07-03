/**
 * AuditLogger - Audit trail for all external operations (自主创新)
 * Tracks all npm registry queries, mirror usage, and operation outcomes.
 */
import { logger } from '../logger.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { sequential } from '../utils/sequential.js';

export interface AuditEntry {
  timestamp: string;
  operation: string;
  packageName?: string;
  mirror: string;
  success: boolean;
  duration: number;
  error?: string;
}

export interface AuditStatistics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  averageDuration: number;
  mirrorUsage: Record<string, number>;
}

export class AuditLogger {
  private readonly log = logger.child('AuditLogger');
  private readonly entries: AuditEntry[] = [];

  /** Sequential file writer — prevents concurrent writes to the same file */
  private readonly writeFileSequential = sequential(async (path: string, content: string) => {
    await mkdir(join(path, '..'), { recursive: true }).catch(() => {});
    await writeFile(path, content, 'utf-8');
  });

  /** Log an external network request */
  logRequest(entry: Omit<AuditEntry, 'timestamp'>): void {
    const fullEntry: AuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };
    this.entries.push(fullEntry);
    this.log.debug('Audit entry recorded', { operation: entry.operation, packageName: entry.packageName, success: entry.success });
  }

  /** Export audit logs to a file (sequential — safe for concurrent calls) */
  async exportLogs(outputPath: string): Promise<void> {
    const content = JSON.stringify(this.entries, null, 2);
    await this.writeFileSequential(outputPath, content);
    this.log.info('Audit logs exported', { path: outputPath, entries: this.entries.length });
  }

  /** Get audit statistics */
  getStatistics(): AuditStatistics {
    const total = this.entries.length;
    const successful = this.entries.filter(e => e.success).length;
    const failed = total - successful;
    const avgDuration = total > 0
      ? this.entries.reduce((sum, e) => sum + e.duration, 0) / total
      : 0;

    const mirrorUsage: Record<string, number> = {};
    for (const entry of this.entries) {
      mirrorUsage[entry.mirror] = (mirrorUsage[entry.mirror] ?? 0) + 1;
    }

    return {
      totalRequests: total,
      successfulRequests: successful,
      failedRequests: failed,
      successRate: total > 0 ? successful / total : 0,
      averageDuration: avgDuration,
      mirrorUsage,
    };
  }

  /** Get all entries */
  getEntries(): readonly AuditEntry[] {
    return this.entries;
  }

  /** Clear all entries */
  clear(): void {
    this.entries.length = 0;
  }
}
