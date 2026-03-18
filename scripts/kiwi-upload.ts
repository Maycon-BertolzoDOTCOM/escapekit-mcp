#!/usr/bin/env ts-node

import { join } from "path";
import { readFileSync } from 'fs';
import { TestResult } from '../src/adapters/index';
import { loadTestResults } from './load-test-results.js';
import { KiwiXmlRpcClient, KiwiConfig } from '../src/lib/kiwi-xmlrpc-http-client.ts';

interface UploadOptions {
  file: string;
  framework?: 'vitest' | 'mocha' | 'custom';
  productId?: number;
  testPlanId?: number;
  verbose?: boolean;
}

class KiwiTCMSUploader {
  private client: KiwiXmlRpcClient;
  private config: KiwiConfig;
  private statusMap: Record<string, number> = {};
  private buildId: number = 0;

  constructor(config: KiwiConfig) {
    this.config = config;
    this.client = new KiwiXmlRpcClient(config);
  }

  /**
   * Inicializar status map
   */
  async initializeStatusMap(): Promise<void> {
    const passedStatus = await this.client.findTestRunStatusByName('PASSED');
    const failedStatus = await this.client.findTestRunStatusByName('FAILED');
    const idleStatus = await this.client.findTestRunStatusByName('IDLE');
    const waivedStatus = await this.client.findTestRunStatusByName('WAIVED');

    if (passedStatus) this.statusMap['passed'] = passedStatus.id;
    if (failedStatus) this.statusMap['failed'] = failedStatus.id;
    if (idleStatus) this.statusMap['skipped'] = idleStatus.id;
    if (waivedStatus) this.statusMap['skipped'] = waivedStatus.id; // Fallback

    console.log(`✓ Status map initialized:`, this.statusMap);
  }

  /**
   * Criar Build se necessário
   */
  async getOrCreateBuild(productId: number, planId: number): Promise<number> {
    // Listar builds existentes
    const builds = await this.client.listBuilds(productId);
    
    if (builds.length > 0) {
      // Usar o build mais recente
      console.log(`✓ Using existing build: ${builds[0].name} (ID: ${builds[0].id})`);
      return builds[0].id;
    }

    // Criar novo build
    console.log('Creating new build...');
    const buildName = `Auto-${new Date().toISOString().split('T')[0]}`;
    
    try {
      const result = await this.client.createBuild(buildName, productId);
      console.log(`✓ Build created: ${result.name} (ID: ${result.id})`);
      return result.id;
    } catch (error: any) {
      console.error('✗ Failed to create build:', error.message);
      throw error;
    }
  }

  /**
   * Criar TestRun
   */
  async createTestRun(buildId: number, planId: number, summary: string): Promise<number> {
    // Get current user ID from authenticated user
    const user = await this.client.getCurrentUser();
    console.log('Current user:', user);
    const managerId = user?.id || 1; // Default to admin (ID 1)
    console.log('Using manager ID:', managerId);
    
    const testRun = await this.client.createTestRun({
      build: buildId,
      plan: planId,
      summary,
      manager: managerId,
    });
    return testRun.id;
  }

  /**
   * Buscar ou criar TestCase
   */
  async getOrCreateTestCase(testName: string, productId: number): Promise<number> {
    // Tentar buscar por nome
    const existing = await this.client.findTestCaseByName(testName);
    if (existing) {
      return existing.id;
    }

    // Criar novo teste case
    console.log(`  Creating new test case: ${testName}`);
    try {
      const result = await this.client.createTestCase({
        name: testName,
        product: productId,
        category: 1, // TODO: Configurar categoria adequada
      });
      return result.id;
    } catch (error: any) {
      console.error(`  ✗ Failed to create test case ${testName}:`, error.message);
      throw error;
    }
  }

  /**
   * Upload resultado de teste
   */
  async uploadTestResult(testResult: TestResult, testRunId: number, productId: number): Promise<void> {
    try {
      // Buscar ou criar TestCase
      const caseId = await this.getOrCreateTestCase(testResult.testCase, productId);

      // Buscar status ID
      const statusId = this.statusMap[testResult.outcome] || this.statusMap['skipped'];

      // Criar TestExecution
      await this.client.addTestExecution({
        case: caseId,
        run: testRunId,
        build: this.buildId,
        status: statusId,
        case_text_version: 1, // Default to version 1
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
  async uploadTestResults(testResults: TestResult[], testRunId: number, productId: number): Promise<void> {
    let successCount = 0;
    let failCount = 0;

    console.log(`\nUploading ${testResults.length} test results...`);

    for (let i = 0; i < testResults.length; i++) {
      const result = testResults[i];
      try {
        await this.uploadTestResult(result, testRunId, productId);
        successCount++;

        // Progress indicator
        if (i % 50 === 0) {
          console.log(`  Progress: ${i}/${testResults.length} (${((i / testResults.length) * 100).toFixed(1)}%)`);
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

  // Load configuration
  let config: KiwiConfig;
  try {
    const configPath = join(process.cwd(), 'config', 'kiwi-tcms.json');
    const configFile = readFileSync(configPath, 'utf-8');
    config = JSON.parse(configFile);
    console.log(`✓ Loaded configuration from ${configPath}`);
  } catch (error: any) {
    console.error('✗ Failed to load configuration:', error.message);
    console.log('Using environment variables...');
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
  }

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

  console.log(`\n📊 Test Statistics:`);
  console.log(`   Total: ${results.length}`);
  console.log(`   Passed: ${passed} (${passRate}%)`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Skipped: ${skipped}`);

  // Create uploader instance
  const uploader = new KiwiTCMSUploader(config);

  // Get Product
  console.log('\nLooking up product...');
  const product = await uploader.client.findProductByName(config.defaultProduct);
  if (!product) {
    console.error(`✗ Product not found: ${config.defaultProduct}`);
    console.log('Available products: (list skipped)');
    process.exit(1);
  }
  console.log(`✓ Found product: ${product.name} (ID: ${product.id})`);

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
  uploader.buildId = buildId; // Store for use in uploadTestResult

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
  
  // Parse command-line arguments properly
  const fileFlagIndex = args.indexOf('--file');
  const file = fileFlagIndex !== -1 ? args[fileFlagIndex + 1] : args[0] || 'vitest-results.json';
  
  const frameworkFlagIndex = args.indexOf('--framework');
  const framework = frameworkFlagIndex !== -1 ? args[frameworkFlagIndex + 1] as any : undefined;
  
  const testPlanIdFlagIndex = args.indexOf('--test-plan-id');
  const testPlanId = testPlanIdFlagIndex !== -1 ? parseInt(args[testPlanIdFlagIndex + 1]) : undefined;
  
  const verbose = args.includes('--verbose');

  uploadResults({ file, framework, testPlanId, verbose })
    .then(() => process.exit(0))
    .catch((err: any) => {
      console.error('Error:', err.message);
      console.error(err.stack);
      process.exit(1);
    });
}