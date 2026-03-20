/**
 * Prometheus Metrics Exporter
 * Converts structured JSON logs to Prometheus-compatible metrics
 *
 * Usage:
 *   npx tsx scripts/metrics-exporter.ts --input logs/kiwi-results.json --port 9090
 *   Or use as library: import { MetricsCollector } from './metrics-exporter'
 */

import { readFileSync, existsSync } from 'fs';
import { createServer, IncomingMessage, ServerResponse } from 'http';

// ─── Types ──────────────────────────────────────────────

export interface MetricsSnapshot {
  // Counters
  upload_total: number;
  upload_success: number;
  upload_errors: number;
  test_passed: number;
  test_failed: number;
  test_skipped: number;
  test_not_found: number;
  cases_created: number;

  // Gauges
  pass_rate: number;
  duration_seconds: number;
  batch_size: number;

  // Histograms (pre-aggregated)
  upload_duration_seconds_buckets: Record<string, number>;
  upload_duration_seconds_sum: number;
  upload_duration_seconds_count: number;

  // Info
  framework: string;
  last_run_timestamp: string;
}

// ─── Collector ──────────────────────────────────────────

export class MetricsCollector {
  private snapshots: MetricsSnapshot[] = [];
  private latest: MetricsSnapshot | null = null;

  /**
   * Parse a structured JSON log line into metrics
   */
  ingestLogLine(line: string): void {
    try {
      const entry = JSON.parse(line);
      if (entry.event === 'upload_complete') {
        const snapshot = this.extractSnapshot(entry);
        this.snapshots.push(snapshot);
        this.latest = snapshot;
      }
    } catch {
      // Not JSON or not our event, skip
    }
  }

  /**
   * Ingest a full JSON log file (one JSON object per line)
   */
  ingestLogFile(filePath: string): void {
    if (!existsSync(filePath)) return;
    const content = readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      if (line.trim()) this.ingestLogLine(line);
    }
  }

  private extractSnapshot(entry: any): MetricsSnapshot {
    const stats = entry.stats || {};
    const durationSec = (entry.duration || 0) / 1000;

    // Build histogram buckets
    const buckets: Record<string, number> = {
      '1': 0,
      '5': 0,
      '10': 0,
      '30': 0,
      '60': 0,
      '120': 0,
      '+Inf': 0,
    };
    for (const threshold of [1, 5, 10, 30, 60, 120]) {
      if (durationSec <= threshold) {
        buckets[String(threshold)] = 1;
      }
    }
    buckets['+Inf'] = 1;

    return {
      upload_total: stats.total || 0,
      upload_success: stats.uploaded || 0,
      upload_errors: stats.errors || 0,
      test_passed: stats.passed || 0,
      test_failed: stats.failed || 0,
      test_skipped: stats.skipped || 0,
      test_not_found: stats.notFound || 0,
      cases_created: 0,
      pass_rate: parseFloat(stats.passRate) || 0,
      duration_seconds: durationSec,
      batch_size: 20,
      upload_duration_seconds_buckets: buckets,
      upload_duration_seconds_sum: durationSec,
      upload_duration_seconds_count: 1,
      framework: entry.framework || 'unknown',
      last_run_timestamp: entry.timestamp || new Date().toISOString(),
    };
  }

  /**
   * Export metrics in Prometheus text exposition format
   */
  toPrometheusText(): string {
    if (!this.latest) return '# No metrics available\n';

    const s = this.latest;
    const lines: string[] = [];

    // Counters
    lines.push('# HELP escapekit_upload_total Total test results processed');
    lines.push('# TYPE escapekit_upload_total counter');
    lines.push(`escapekit_upload_total{framework="${s.framework}"} ${s.upload_total}`);

    lines.push('# HELP escapekit_upload_success Successfully uploaded results');
    lines.push('# TYPE escapekit_upload_success counter');
    lines.push(`escapekit_upload_success{framework="${s.framework}"} ${s.upload_success}`);

    lines.push('# HELP escapekit_upload_errors Upload errors');
    lines.push('# TYPE escapekit_upload_errors counter');
    lines.push(`escapekit_upload_errors{framework="${s.framework}"} ${s.upload_errors}`);

    lines.push('# HELP escapekit_tests_passed Passed tests');
    lines.push('# TYPE escapekit_tests_passed counter');
    lines.push(`escapekit_tests_passed{framework="${s.framework}"} ${s.test_passed}`);

    lines.push('# HELP escapekit_tests_failed Failed tests');
    lines.push('# TYPE escapekit_tests_failed counter');
    lines.push(`escapekit_tests_failed{framework="${s.framework}"} ${s.test_failed}`);

    lines.push('# HELP escapekit_tests_skipped Skipped tests');
    lines.push('# TYPE escapekit_tests_skipped counter');
    lines.push(`escapekit_tests_skipped{framework="${s.framework}"} ${s.test_skipped}`);

    lines.push('# HELP escapekit_tests_not_found Test cases not found in Kiwi');
    lines.push('# TYPE escapekit_tests_not_found counter');
    lines.push(`escapekit_tests_not_found{framework="${s.framework}"} ${s.test_not_found}`);

    // Gauges
    lines.push('# HELP escapekit_pass_rate Pass rate percentage');
    lines.push('# TYPE escapekit_pass_rate gauge');
    lines.push(`escapekit_pass_rate{framework="${s.framework}"} ${s.pass_rate}`);

    lines.push('# HELP escapekit_duration_seconds Last upload duration');
    lines.push('# TYPE escapekit_duration_seconds gauge');
    lines.push(`escapekit_duration_seconds{framework="${s.framework}"} ${s.duration_seconds}`);

    lines.push('# HELP escapekit_last_run_timestamp_seconds Last run Unix timestamp');
    lines.push('# TYPE escapekit_last_run_timestamp_seconds gauge');
    const ts = Math.floor(new Date(s.last_run_timestamp).getTime() / 1000);
    lines.push(`escapekit_last_run_timestamp_seconds ${ts}`);

    // Histogram
    lines.push('# HELP escapekit_upload_duration_seconds Upload duration histogram');
    lines.push('# TYPE escapekit_upload_duration_seconds histogram');
    for (const [le, count] of Object.entries(s.upload_duration_seconds_buckets)) {
      lines.push(`escapekit_upload_duration_seconds_bucket{le="${le}"} ${count}`);
    }
    lines.push(`escapekit_upload_duration_seconds_sum ${s.upload_duration_seconds_sum}`);
    lines.push(`escapekit_upload_duration_seconds_count ${s.upload_duration_seconds_count}`);

    return lines.join('\n') + '\n';
  }

  getLatest(): MetricsSnapshot | null {
    return this.latest;
  }

  getCount(): number {
    return this.snapshots.length;
  }
}

// ─── HTTP Server ────────────────────────────────────────

function startMetricsServer(collector: MetricsCollector, port: number): void {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
      res.end(collector.toPrometheusText());
    } else if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', snapshots: collector.getCount() }));
    } else {
      res.writeHead(404);
      res.end('Not Found. Use /metrics or /health');
    }
  });

  server.listen(port, () => {
    console.log(`Metrics server listening on http://localhost:${port}/metrics`);
  });
}

// ─── CLI ────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const input = getArg('--input') || getArg('-i');
  const port = parseInt(getArg('--port') || getArg('-p') || '9090');
  const once = args.includes('--once');

  const collector = new MetricsCollector();

  if (input) {
    collector.ingestLogFile(input);
    if (once) {
      console.log(collector.toPrometheusText());
      process.exit(0);
    }
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Prometheus Metrics Exporter for EscapeKit

Usage:
  npx tsx scripts/metrics-exporter.ts [options]

Options:
  -i, --input <file>   JSON log file to ingest
  -p, --port <port>    HTTP server port (default: 9090)
  --once               Output metrics once and exit (no server)
  -h, --help           Show this help

Examples:
  # Start metrics server
  npx tsx scripts/metrics-exporter.ts --input logs/upload.log

  # One-shot output
  npx tsx scripts/metrics-exporter.ts --input logs/upload.log --once
`);
    process.exit(0);
  }

  startMetricsServer(collector, port);
}
