#!/usr/bin/env tsx

/**
 * Kiwi TCMS Upload via REST API v2
 * Sprint 3: Auto-detection, structured JSON logs, executive summary
 */

import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { TestResult } from '../src/adapters/index';
import { loadTestResults, Framework } from './load-test-results';
import { KiwiClient, KiwiClientConfig } from '../src/lib/kiwi-client';

// ─── Types ──────────────────────────────────────────────

interface UploadOptions {
  file: string;
  framework?: Framework;
  productId?: number;
  productName?: string;
  testPlanId?: number;
  verbose?: boolean;
  autoCreateCases?: boolean;
  dryRun?: boolean;
  jsonLogs?: boolean;
  buildMetadata?: BuildMetadata;
}

interface BuildMetadata {
  runId?: string;
  runNumber?: string;
  sha?: string;
  ref?: string;
  headRef?: string;
  baseRef?: string;
  actor?: string;
  eventName?: string;
}

interface UploadStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  uploaded: number;
  errors: number;
  notFound: number;
  duration: number;
}

// ─── Structured Logger ─────────────────────────────────

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: Record<string, any>;
}

class StructuredLogger {
  private entries: LogEntry[] = [];
  private startTime = Date.now();
  private jsonMode: boolean;
  private verbose: boolean;

  constructor(options: { jsonLogs?: boolean; verbose?: boolean } = {}) {
    this.jsonMode = options.jsonLogs ?? false;
    this.verbose = options.verbose ?? false;
  }

  private emit(level: LogEntry['level'], message: string, data?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };

    if (this.jsonMode) {
      // Output only JSON lines
      if (level !== 'debug' || this.verbose) {
        process.stdout.write(JSON.stringify(entry) + '\n');
      }
    } else {
      // Human-readable output
      if (level === 'error') {
        console.error(`❌ ${message}`, data ? JSON.stringify(data) : '');
      } else if (level === 'warn') {
        console.warn(`⚠️  ${message}`);
      } else if (level === 'debug' && this.verbose) {
        console.log(`🔍 ${message}`);
      } else {
        console.log(message);
      }
    }

    this.entries.push(entry);
  }

  info(message: string, data?: Record<string, any>): void {
    this.emit('info', message, data);
  }

  warn(message: string, data?: Record<string, any>): void {
    this.emit('warn', message, data);
  }

  error(message: string, data?: Record<string, any>): void {
    this.emit('error', message, data);
  }

  debug(message: string, data?: Record<string, any>): void {
    this.emit('debug', message, data);
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  getElapsedMs(): number {
    return Date.now() - this.startTime;
  }
}

// ─── Helpers ────────────────────────────────────────────

function loadConfig(): KiwiClientConfig {
  const configPath = join(process.cwd(), 'config', 'kiwi-tcms.json');
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const resolved = raw.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] || '');
    const config = JSON.parse(resolved);
    return {
      baseUrl: config.baseUrl || process.env.KIWI_URL || '',
      username: config.username || process.env.KIWI_USERNAME || '',
      password: config.password || process.env.KIWI_PASSWORD || '',
      timeout: config.timeout || 15000,
      retries: config.retries || 3,
    };
  } catch {
    return {
      baseUrl: process.env.KIWI_URL || '',
      username: process.env.KIWI_USERNAME || '',
      password: process.env.KIWI_PASSWORD || '',
      timeout: 15000,
      retries: 3,
    };
  }
}

function generateTestRunNotes(stats: UploadStats, meta?: BuildMetadata): string {
  const lines: string[] = [];
  lines.push(
    `Test Results: ${stats.passed} passed, ${stats.failed} failed, ${stats.skipped} skipped`
  );
  lines.push(`Duration: ${(stats.duration / 1000).toFixed(1)}s`);
  if (meta) {
    lines.push('');
    if (meta.sha) lines.push(`Commit: ${meta.sha.substring(0, 7)}`);
    if (meta.ref) lines.push(`Branch: ${meta.ref.replace('refs/heads/', '')}`);
    if (meta.actor) lines.push(`Triggered by: ${meta.actor}`);
    if (meta.runId) lines.push(`Run ID: ${meta.runId}`);
  }
  return lines.join('\n');
}

// ─── Main ──────────────────────────────────────────────

export async function uploadResults(options: UploadOptions): Promise<UploadStats> {
  const log = new StructuredLogger({ jsonLogs: options.jsonLogs, verbose: options.verbose });
  const startTime = Date.now();

  const config = loadConfig();

  if (!config.baseUrl || !config.username || !config.password) {
    log.error('Missing Kiwi TCMS configuration', {
      hint: 'Set KIWI_URL, KIWI_USERNAME, KIWI_PASSWORD or config/kiwi-tcms.json',
    });
    process.exit(1);
  }

  log.info(`Kiwi TCMS: ${config.baseUrl}`);

  // Load test results (auto-detects framework if not specified)
  const results = await loadTestResults({
    source: options.file,
    framework: options.framework,
  });

  // Determine detected framework
  const detectedFramework = options.framework || 'auto-detected';

  const stats: UploadStats = {
    total: results.length,
    passed: results.filter(r => r.outcome === 'passed').length,
    failed: results.filter(r => r.outcome === 'failed').length,
    skipped: results.filter(r => r.outcome === 'skipped').length,
    uploaded: 0,
    errors: 0,
    notFound: 0,
    duration: 0,
  };

  const passRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : '0.0';

  log.info(`Loaded ${stats.total} test results`, {
    framework: detectedFramework,
    file: options.file,
    passed: stats.passed,
    failed: stats.failed,
    skipped: stats.skipped,
    passRate: `${passRate}%`,
  });

  if (options.dryRun) {
    log.info('DRY-RUN MODE — no data will be sent');
    stats.duration = Date.now() - startTime;
    return stats;
  }

  // Initialize client
  const client = new KiwiClient(config);
  log.info('Authenticating...');
  const ok = await client.authenticate();
  if (!ok) {
    log.error('Authentication failed');
    process.exit(1);
  }

  // Resolve product
  let product: { id: number; name: string };
  if (options.productId) {
    const found = await client.findProductById(options.productId);
    if (!found) {
      log.error(`Product not found with ID: ${options.productId}`);
      const products = await client.listProducts();
      log.info('Available products: ' + products.map(p => `${p.name} (${p.id})`).join(', '));
      process.exit(1);
    }
    product = found;
  } else {
    const name = options.productName || process.env.KIWI_PRODUCT_NAME || 'EscapeKit';
    const found = await client.findProductByName(name);
    if (!found) {
      log.error(`Product not found: ${name}`);
      const products = await client.listProducts();
      log.info('Available products: ' + products.map(p => `${p.name} (${p.id})`).join(', '));
      process.exit(1);
    }
    product = found;
  }
  log.info(`Product: ${product.name} (ID: ${product.id})`);

  // Resolve test plan
  const testPlanId = options.testPlanId || parseInt(process.env.KIWI_TEST_PLAN_ID || '1');
  log.info(`Test Plan: ${testPlanId}`);

  // Get status map
  const statusMap = await client.getStatusMap();
  log.debug('Status map', statusMap);

  // Get or create build
  const buildName = `Auto-${options.buildMetadata?.runNumber || new Date().toISOString().split('T')[0]}`;
  const versionId = await client.getOrCreateVersion(product.id, '1.0');
  
  // First try to find existing build with matching name and product
  const existingBuilds = await client.listBuilds(product.id);
  const existingBuild = existingBuilds.find(b => b.name === buildName);
  
  let build;
  if (existingBuild) {
    build = existingBuild;
    log.debug(`Using existing build: ${build.name} (ID: ${build.id})`);
  } else {
    // Create new build with proper validation
    build = await client.getOrCreateBuild(product.id, buildName, versionId);
    log.debug(`Created new build: ${build.name} (ID: ${build.id})`);
  }
  
  log.info(`Build: ${build.name} (ID: ${build.id})`);

  // Get default category
  const categoryId = await client.getDefaultCategoryId(product.id);
  log.debug(`Category ID: ${categoryId}`);

  // Create test run
  const testRunName = `AutoTest-${new Date().toISOString().split('T')[0]}`;
  const testRun = await client.createTestRun({
    summary: testRunName,
    plan: testPlanId,
    build: build.id,
    manager: 1,
    notes: generateTestRunNotes(stats, options.buildMetadata),
  });
  log.info(`TestRun created: ${testRun.summary} (ID: ${testRun.id})`);

  // Upload results
  const BATCH_SIZE = 20;
  const BATCH_DELAY_MS = 500;
  const missingTests: string[] = [];
  const failedUploads: Array<{ name: string; error: string }> = [];

  log.info(`Uploading ${results.length} results in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = results.slice(i, Math.min(i + BATCH_SIZE, results.length));

    const promises = batch.map(async result => {
      try {
        let testCase;

        if (options.autoCreateCases) {
          testCase = await client.getOrCreateTestCase(result.testCase, product.id, categoryId);
        } else {
          testCase = await client.findTestCase(result.testCase);
          if (!testCase) {
            missingTests.push(result.testCase);
            log.debug(`Not found: ${result.testCase}`);
            return;
          }
        }

        const statusId = statusMap[result.outcome] || statusMap['skipped'];
        await client.addTestExecution({
          case: testCase.id,
          run: testRun.id,
          build: build.id,
          status: statusId,
          case_text_version: 1,
          comment: result.error || '',
        });

        stats.uploaded++;
        log.debug(`Uploaded: ${result.testCase} (${result.outcome})`);
      } catch (err: any) {
        stats.errors++;
        failedUploads.push({ name: result.testCase, error: err.message });
        log.warn(`Failed: ${result.testCase}`, { error: err.message });
      }
    });

    await Promise.allSettled(promises);

    const progress = ((Math.min(i + BATCH_SIZE, results.length) / results.length) * 100).toFixed(1);
    log.debug(
      `Progress: ${Math.min(i + BATCH_SIZE, results.length)}/${results.length} (${progress}%)`
    );

    if (i + BATCH_SIZE < results.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  stats.notFound = [...new Set(missingTests)].length;
  stats.duration = Date.now() - startTime;

  // Save failure log
  if (failedUploads.length > 0) {
    const logDir = join(process.cwd(), 'logs');
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
    const logFile = join(logDir, `kiwi-failures-${new Date().toISOString().split('T')[0]}.json`);
    writeFileSync(logFile, JSON.stringify(failedUploads, null, 2));
    log.warn(`${failedUploads.length} failures logged to ${logFile}`);
  }

  // Report missing tests
  if (missingTests.length > 0) {
    const unique = [...new Set(missingTests)];
    log.warn(`${unique.length} test case(s) not found in Kiwi TCMS`);
    unique.slice(0, 10).forEach(name => log.info(`  - ${name}`));
    if (unique.length > 10) log.info(`  ... and ${unique.length - 10} more`);
    log.info('Hint: Use --auto-create-cases to create missing test cases automatically');
  }

  // Cache stats
  const cacheStats = client.getCacheStats();
  log.debug('Cache stats', cacheStats);

  // ─── Executive Summary ───────────────────────────────

  const kiwiUrl = config.baseUrl.replace(/\/+$/, '');
  const testRunUrl = `${kiwiUrl}/runs/${testRun.id}`;
  const productUrl = `${kiwiUrl}/admin/testcases/testcase/?product__id=${product.id}`;
  const planUrl = testPlanId ? `${kiwiUrl}/plan/${testPlanId}/` : undefined;

  if (options.jsonLogs) {
    // Structured JSON summary
    const summary = {
      event: 'upload_complete',
      timestamp: new Date().toISOString(),
      duration: stats.duration,
      framework: detectedFramework,
      file: options.file,
      stats: {
        total: stats.total,
        passed: stats.passed,
        failed: stats.failed,
        skipped: stats.skipped,
        uploaded: stats.uploaded,
        errors: stats.errors,
        notFound: stats.notFound,
        passRate: `${passRate}%`,
      },
      kiwi: {
        testRunId: testRun.id,
        testRunUrl,
        product: product.name,
        productId: product.id,
        build: build.name,
        planId: testPlanId,
      },
      links: {
        testRun: testRunUrl,
        product: productUrl,
        ...(planUrl ? { plan: planUrl } : {}),
      },
      cache: cacheStats,
    };
    process.stdout.write(JSON.stringify(summary) + '\n');
  } else {
    // Human-readable executive summary
    const status = stats.errors > 0 ? '⚠️  COMPLETED WITH ERRORS' : '✅ SUCCESS';
    const durationSec = (stats.duration / 1000).toFixed(1);

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  ${status}`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`  Framework:    ${detectedFramework}`);
    console.log(`  Duration:     ${durationSec}s`);
    console.log(
      `  Results:      ${stats.passed} passed / ${stats.failed} failed / ${stats.skipped} skipped`
    );
    console.log(`  Pass Rate:    ${passRate}%`);
    console.log(`  Uploaded:     ${stats.uploaded}/${stats.total}`);
    if (stats.errors > 0) console.log(`  Errors:       ${stats.errors}`);
    if (stats.notFound > 0) console.log(`  Not Found:    ${stats.notFound}`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`  Links:`);
    console.log(`    TestRun:    ${testRunUrl}`);
    console.log(`    Product:    ${productUrl}`);
    if (planUrl) console.log(`    Plan:       ${planUrl}`);
    console.log(`${'─'.repeat(60)}\n`);
  }

  return stats;
}

// ─── CLI ────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const getArg = (flag: string, shortFlag?: string) => {
    let idx = args.indexOf(flag);
    if (idx === -1 && shortFlag) idx = args.indexOf(shortFlag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const file =
    getArg('--file', '-f') ||
    args.find(a => !a.startsWith('--') && !a.startsWith('-')) ||
    'vitest-results.json';
  const framework = getArg('--framework') as Framework | undefined;
  const productId = getArg('--product-id') ? parseInt(getArg('--product-id')!) : undefined;
  const productName = getArg('--product-name');
  const testPlanId = getArg('--test-plan-id') ? parseInt(getArg('--test-plan-id')!) : undefined;
  const verbose = args.includes('--verbose');
  const autoCreateCases = args.includes('--auto-create-cases');
  const dryRun = args.includes('--dry-run');
  const jsonLogs = args.includes('--json-logs') || process.env.KIWI_JSON_LOGS === 'true';

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Kiwi TCMS Upload (REST API)

Usage:
  kiwi-upload-rest [options]

Options:
  -f, --file <path>          Test results file (required)
  --framework <name>         Framework: vitest|jest|mocha|playwright|cypress|custom
                             (auto-detected if omitted)
  --product-id <id>          Product ID
  --product-name <name>      Product name
  --test-plan-id <id>        Test plan ID
  --auto-create-cases        Auto-create missing test cases
  --dry-run                  Validate without uploading
  --verbose                  Verbose output
  --json-logs                Output structured JSON logs (for CI/CD)
  -h, --help                 Show help

Environment:
  KIWI_URL, KIWI_USERNAME, KIWI_PASSWORD, KIWI_TEST_PLAN_ID
  KIWI_JSON_LOGS=true        Enable JSON log output
`);
    process.exit(0);
  }

  uploadResults({
    file,
    framework,
    productId,
    productName,
    testPlanId,
    verbose,
    autoCreateCases,
    dryRun,
    jsonLogs,
  })
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}
