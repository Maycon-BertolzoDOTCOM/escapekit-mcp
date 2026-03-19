#!/usr/bin/env ts-node

import { join } from 'path';
import { readFileSync } from 'fs';
import { TestResult } from '../src/adapters/index';
import { loadTestResults } from './load-test-results';
import { KiwiXmlRpcClient } from '../src/lib/kiwi-xmlrpc-client.cjs';

interface KiwiConfig {
  baseUrl: string;
  username: string;
  password: string;
  defaultProduct?: string;
  defaultPlanId?: number;
  testRunTemplate?: string;
  timeout?: number;
  retries?: number;
}

interface UploadOptions {
  file: string;
  framework?: 'vitest' | 'mocha' | 'custom';
  productId?: number;
  productName?: string;
  testPlanId?: number;
  verbose?: boolean;
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

class KiwiTCMSUploader {
  private client: KiwiXmlRpcClient;
  private config: KiwiConfig;
  private statusMap: Record<string, number> = {};

  constructor(
    config: KiwiConfig,
    private buildMetadata?: BuildMetadata
  ) {
    this.config = config;
    this.client = new KiwiXmlRpcClient(config);
  }

  /**
   * Inicializar status map
   */
  async initializeStatusMap(): Promise<void> {
    try {
      const passedStatus = await this.client.findTestExecutionStatusByName('PASSED');
      const failedStatus = await this.client.findTestExecutionStatusByName('FAILED');
      const idleStatus = await this.client.findTestExecutionStatusByName('IDLE');
      const waivedStatus = await this.client.findTestExecutionStatusByName('WAIVED');

      if (passedStatus) this.statusMap['passed'] = passedStatus.id;
      if (failedStatus) this.statusMap['failed'] = failedStatus.id;
      if (idleStatus) this.statusMap['skipped'] = idleStatus.id;
      if (waivedStatus) this.statusMap['skipped'] = waivedStatus.id;
    } catch (e) {
      console.log('🔍 DEBUG: Status lookup failed, using defaults');
    }

    // Fallback para IDs padrão do Kiwi TCMS se não encontrou
    if (!this.statusMap['passed']) this.statusMap['passed'] = 2;
    if (!this.statusMap['failed']) this.statusMap['failed'] = 3;
    if (!this.statusMap['skipped']) this.statusMap['skipped'] = 1;

    console.log(`✓ Status map initialized:`, this.statusMap);
  }

  /**
   * Criar Build se necessário
   */
  async getOrCreateBuild(productId: number, planId: number): Promise<number> {
    const builds = await this.client.listBuilds(productId);

    if (builds.length > 0) {
      console.log(`✓ Using existing build: ${builds[0].name} (ID: ${builds[0].id})`);
      return builds[0].id;
    }

    // Criar novo build com metadados
    console.log('Creating new build with metadata...');
    const buildName = `Auto-${this.buildMetadata?.runNumber || new Date().toISOString().split('T')[0]}`;

    try {
      console.log('🔍 DEBUG productId:', productId, typeof productId);
      const buildData = {
        name: buildName,
        product: productId,
        version: productId,
        description: this.generateBuildDescription(),
      };
      console.log('🔍 DEBUG buildData:', JSON.stringify(buildData));
      const result = await this.client.createBuild(buildData);
      console.log(`✓ Build created: ${result.name} (ID: ${result.id})`);
      return result.id;
    } catch (err) {
      console.error('✗ Failed to create build:', err);
      throw err;
    }
  }

  /**
   * Gerar descrição do build com metadados
   */
  private generateBuildDescription(): string {
    if (!this.buildMetadata) {
      return 'Automated test run';
    }

    const lines: string[] = ['Build Information:'];

    if (this.buildMetadata.runNumber) {
      lines.push(`Run #${this.buildMetadata.runNumber}`);
    }
    if (this.buildMetadata.sha) {
      lines.push(`Commit: ${this.buildMetadata.sha.substring(0, 7)}`);
    }
    if (this.buildMetadata.ref) {
      lines.push(`Branch: ${this.buildMetadata.ref.replace('refs/heads/', '')}`);
    }
    if (this.buildMetadata.actor) {
      lines.push(`Triggered by: ${this.buildMetadata.actor}`);
    }
    if (this.buildMetadata.eventName) {
      lines.push(`Event: ${this.buildMetadata.eventName}`);
    }

    return lines.join('\n');
  }

  /**
   * Criar TestRun
   */
  async createTestRun(buildId: number, planId: number, summary: string): Promise<number> {
    return this.client.createTestRun({
      build: buildId,
      plan: planId,
      summary,
      manager: 1, // admin user ID
    });
  }

  /**
   * Buscar ou criar TestCase
   */
  async getOrCreateTestCase(testName: string, productId: number): Promise<number> {
    const existing = await this.client.findTestCaseByName(testName);
    if (existing) {
      return existing.id;
    }

    if (this.config.verbose) {
      console.log(`  Creating new test case: ${testName}`);
    }
    return new Promise<number>((resolve, reject) => {
      const xmlrpcClient = (this.client as any).client;
      xmlrpcClient.methodCall(
        'TestCase.create',
        [
          {
            name: testName,
            product: productId,
            category: 1,
          },
        ],
        (err: any, result: any) => {
          if (err) {
            console.error(`  ✗ Failed to create test case ${testName}:`, err);
            reject(err);
            return;
          }
          resolve(result.id);
        }
      );
    });
  }

  /**
   * Upload resultado de teste
   */
  async uploadTestResult(
    testResult: TestResult,
    testRunId: number,
    productId: number
  ): Promise<void> {
    try {
      const caseId = await this.getOrCreateTestCase(testResult.testCase, productId);
      const statusId = this.statusMap[testResult.outcome] || this.statusMap['skipped'];

      await this.client.addTestExecution({
        case: caseId,
        run: testRunId,
        status: statusId,
        comment: testResult.error || testResult.failureMessage || '',
      });

      if (this.config.verbose) {
        console.log(`  ✓ Uploaded: ${testResult.testCase} (${testResult.outcome})`);
      }
    } catch (error: any) {
      console.error(`  ✗ Failed to upload ${testResult.testCase}:`, error.message);
      throw error;
    }
  }

  /**
   * Upload resultados em lote
   */
  async uploadTestResults(
    testResults: TestResult[],
    testRunId: number,
    productId: number
  ): Promise<void> {
    let successCount = 0;
    let failCount = 0;

    console.log(`\nUploading ${testResults.length} test results...`);

    for (let i = 0; i < testResults.length; i++) {
      const result = testResults[i];
      try {
        await this.uploadTestResult(result, testRunId, productId);
        successCount++;

        if (i % 50 === 0) {
          console.log(
            `  Progress: ${i}/${testResults.length} (${((i / testResults.length) * 100).toFixed(1)}%)`
          );
        }
      } catch (error) {
        failCount++;
      }
    }

    console.log(`\n✓ Upload complete: ${successCount} successful, ${failCount} failed`);
  }
}

export async function uploadResults(options: UploadOptions): Promise<void> {
  console.log('🚀 Starting Kiwi TCMS upload via XML-RPC...');

  // DEBUG: Log environment variables
  console.log('🔍 DEBUG: Environment variables:');
  console.log(`  KIWI_URL exists: ${!!process.env.KIWI_URL}`);
  console.log(`  KIWI_URL value: ${process.env.KIWI_URL}`);
  console.log(`  KIWI_USERNAME exists: ${!!process.env.KIWI_USERNAME}`);
  console.log(`  KIWI_PASSWORD exists: ${!!process.env.KIWI_PASSWORD ? '***' : 'false'}`);

  // Load configuration
  let config: KiwiConfig;
  try {
    const configPath = join(process.cwd(), 'config', 'kiwi-tcms.json');
    const configFile = readFileSync(configPath, 'utf-8');
    console.log(`🔍 DEBUG: Raw config file content:`);
    console.log(configFile);

    config = JSON.parse(configFile);
    console.log(`🔍 DEBUG: Parsed config before substitution:`);
    console.log(JSON.stringify(config, null, 2));

    // Substitute environment variables in config values
    console.log(`🔍 DEBUG: Starting environment variable substitution...`);
    const resolvedConfig = JSON.stringify(config).replace(/\$\{(\w+)\}/g, (_, key) => {
      const value = process.env[key];
      console.log(`  Replacing $\{${key}\} with "${value}"`);
      return value || '';
    });
    console.log(`🔍 DEBUG: Config after substitution:`);
    console.log(resolvedConfig);
    config = JSON.parse(resolvedConfig);

    console.log(`✓ Loaded configuration from ${configPath}`);
    console.log(`  baseUrl: ${config.baseUrl}`);
  } catch (error: any) {
    console.error('✗ Failed to load configuration:', error.message);
    console.log('Using environment variables...');
    console.log(`🔍 DEBUG: Using fallback config`);
    console.log(`  KIWI_URL from env: ${process.env.KIWI_URL}`);
    config = {
      baseUrl: process.env.KIWI_URL || 'https://kiwi.example.com',
      username: process.env.KIWI_USERNAME || '',
      password: process.env.KIWI_PASSWORD || '',
      defaultProduct: process.env.KIWI_PRODUCT_NAME || 'EscapeKit',
      defaultPlanId: parseInt(process.env.KIWI_TEST_PLAN_ID || '1'),
      testRunTemplate: 'AutoTest-{DATE}',
      timeout: 5000,
      retries: 3,
    };
    console.log(`🔍 DEBUG: Fallback config baseUrl: ${config.baseUrl}`);
  }

  // Build metadata from environment
  const buildMetadata: BuildMetadata = {
    runId: process.env.GITHUB_RUN_ID || options.buildMetadata?.runId,
    runNumber: process.env.GITHUB_RUN_NUMBER || options.buildMetadata?.runNumber,
    sha: process.env.GITHUB_SHA || options.buildMetadata?.sha,
    ref: process.env.GITHUB_REF || options.buildMetadata?.ref,
    headRef: process.env.GITHUB_HEAD_REF || options.buildMetadata?.headRef,
    baseRef: process.env.GITHUB_BASE_REF || options.buildMetadata?.baseRef,
    actor: process.env.GITHUB_ACTOR || options.buildMetadata?.actor,
    eventName: process.env.GITHUB_EVENT_NAME || options.buildMetadata?.eventName,
  };

  // Load test results
  const results = await loadTestResults({
    source: options.file,
    framework: options.framework,
  });
  console.log(`✓ Loaded ${results.length} test results`);

  // Calculate statistics
  const passed = results.filter((r: TestResult) => r.outcome === 'passed').length;
  const failed = results.filter((r: TestResult) => r.outcome === 'failed').length;
  const skipped = results.filter((r: TestResult) => r.outcome === 'skipped').length;
  const passRate = ((passed / results.length) * 100).toFixed(2);

  console.log(`\n?? Test Statistics:`);
  console.log(`   Total: ${results.length}`);
  console.log(`   Passed: ${passed} (${passRate}%)`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Skipped: ${skipped}`);
  // Create uploader instance
  const uploader = new KiwiTCMSUploader(config, buildMetadata);

  // Authenticate with Kiwi TCMS
  console.log('\nAuthenticating to Kiwi TCMS...');
  await uploader.client.authenticate();

  // Get Product - FIXED: Support both productId and productName
  console.log('Looking up product...');
  let product: any;

  if (options.productId) {
    // Use productId directly if provided
    try {
      const products = await uploader.client.listProducts();
      product = products.find((p: any) => p.id === options.productId);

      if (!product) {
        console.error(`✗ Product not found with ID: ${options.productId}`);
        console.log('Available products:');
        for (const p of products) {
          console.log(`  - ${p.name} (ID: ${p.id})`);
        }
        process.exit(1);
      }

      console.log(`✓ Found product by ID: ${product.name} (ID: ${product.id})`);
    } catch (error: any) {
      console.error('✗ Error looking up product by ID:', error.message);
      process.exit(1);
    }
  } else {
    // Use product name if productId not provided
    const productName = options.productName || config.defaultProduct;
    try {
      product = await uploader.client.findProductByName(productName);

      if (!product) {
        console.error(`✗ Product not found: ${productName}`);
        console.log('Available products:');
        const products = await uploader.client.listProducts();
        for (const p of products) {
          console.log(`  - ${p.name} (ID: ${p.id})`);
        }
        process.exit(1);
      }

      console.log(`✓ Found product by name: ${product.name} (ID: ${product.id})`);
    } catch (error: any) {
      console.error('✗ Error looking up product:', error.message);
      process.exit(1);
    }
  }

  // Get TestPlan
  const testPlanId = options.testPlanId || config.defaultPlanId;
  if (!testPlanId) {
    console.error('✗ Test plan ID not specified');
    process.exit(1);
  }
  console.log(`✓ Using TestPlan ID: ${testPlanId}`);

  // Initialize status map
  await uploader.initializeStatusMap();

  // Get or create Build
  const buildId = await uploader.getOrCreateBuild(product.id, testPlanId);

  // Create test run
  const testRunName = config.testRunTemplate
    ? config.testRunTemplate.replace('{DATE}', new Date().toISOString().split('T')[0])
    : `AutoTest-${new Date().toISOString().split('T')[0]}`;

  console.log(`\nCreating TestRun: ${testRunName}`);
  const testRunId = await uploader.createTestRun(buildId, testPlanId, testRunName);
  console.log(`✓ TestRun created with ID: ${testRunId}`);

  // Upload results
  await uploader.uploadTestResults(results, testRunId, product.id);

  console.log(`\n✅ Upload complete!`);
  console.log(`📊 TestRun ID: ${testRunId}`);
  console.log(`🔗 View results at: ${config.baseUrl}/runs/${testRunId}`);
}

// Check if this module is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  const fileFlagIndex = args.indexOf('--file');
  const file = fileFlagIndex !== -1 ? args[fileFlagIndex + 1] : args[0] || 'vitest-results.json';

  const frameworkFlagIndex = args.indexOf('--framework');
  const framework = frameworkFlagIndex !== -1 ? (args[frameworkFlagIndex + 1] as any) : undefined;

  const productIdFlagIndex = args.indexOf('--product-id');
  const productId = productIdFlagIndex !== -1 ? parseInt(args[productIdFlagIndex + 1]) : undefined;

  const productNameFlagIndex = args.indexOf('--product-name');
  const productName = productNameFlagIndex !== -1 ? args[productNameFlagIndex + 1] : undefined;

  const testPlanIdFlagIndex = args.indexOf('--test-plan-id');
  const testPlanId =
    testPlanIdFlagIndex !== -1 ? parseInt(args[testPlanIdFlagIndex + 1]) : undefined;

  const verbose = args.includes('--verbose');

  uploadResults({ file, framework, productId, productName, testPlanId, verbose })
    .then(() => process.exit(0))
    .catch((err: any) => {
      console.error('Error:', err.message);
      console.error(err.stack);
      process.exit(1);
    });
}
