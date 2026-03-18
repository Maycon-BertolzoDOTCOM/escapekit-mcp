#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { KiwiXmlRpcClient } = require('../src/lib/kiwi-xmlrpc-client.cjs');

class KiwiTCMSUploader {
  constructor(config) {
    this.config = config;
    this.client = new KiwiXmlRpcClient(config);
    this.statusMap = {};
  }

  /**
   * Inicializar status map
   */
  async initializeStatusMap() {
    const passedStatus = await this.client.findTestExecutionStatusByName('PASSED');
    const failedStatus = await this.client.findTestExecutionStatusByName('FAILED');
    const idleStatus = await this.client.findTestExecutionStatusByName('IDLE');
    const waivedStatus = await this.client.findTestExecutionStatusByName('WAIVED');

    if (passedStatus) this.statusMap['passed'] = passedStatus.id;
    if (failedStatus) this.statusMap['failed'] = failedStatus.id;
    if (idleStatus) this.statusMap['skipped'] = idleStatus.id;
    if (waivedStatus) this.statusMap['skipped'] = waivedStatus.id; // Fallback

    console.log(`✓ Status map initialized:`, this.statusMap);
  }

  /**
   * Criar Build se necessário
   */
  async getOrCreateBuild(productId) {
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
    
    const result = await this.client.createBuild({
      name: buildName,
      product: productId,
    });
    console.log(`✓ Build created: ${result.name} (ID: ${result.id})`);
    return result.id;
  }

  /**
   * Criar TestRun
   */
  async createTestRun(buildId, planId, summary) {
    return this.client.createTestRun({
      build: buildId,
      plan: planId,
      summary,
    });
  }

  /**
   * Buscar ou criar TestCase
   */
  async getOrCreateTestCase(testName, productId) {
    // Tentar buscar por nome
    const existing = await this.client.findTestCaseByName(testName);
    if (existing) {
      return existing.id;
    }

    // Criar novo teste case
    if (this.config.verbose) {
      console.log(`  Creating new test case: ${testName}`);
    }
    const result = await this.client.createTestCase({
      name: testName,
      product: productId,
      category: 1, // TODO: Configurar categoria adequada
    });
    return result.id;
  }

  /**
   * Upload resultado de teste
   */
  async uploadTestResult(testResult, testRunId, productId) {
    try {
      // Buscar ou criar TestCase
      const caseId = await this.getOrCreateTestCase(testResult.testCase, productId);

      // Buscar status ID
      const statusId = this.statusMap[testResult.outcome] || this.statusMap['skipped'];

      // Criar TestExecution
      await this.client.addTestExecution({
        case: caseId,
        run: testRunId,
        status: statusId,
        comment: testResult.error || testResult.failureMessage || '',
      });

      if (this.config.verbose) {
        console.log(`  ✓ Uploaded: ${testResult.testCase} (${testResult.outcome})`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to upload ${testResult.testCase}:`, error.message);
      throw error;
    }
  }

  /**
   * Upload resultados em lote
   */
  async uploadTestResults(testResults, testRunId, productId) {
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

function loadVitestResults(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  const results = [];

  for (const testFile of data.testResults || []) {
    for (const assertion of (data.testResults[0]?.assertionResults || [])) {
      // Vitest format
    }
  }

  // Simple parser for Vitest format
  for (const testFile of data.testResults || []) {
    for (const assertion of testFile.assertionResults || []) {
      results.push({
        testCase: assertion.title || testFile.name || 'Unknown Test',
        outcome: assertion.status === 'passed' ? 'passed' : 
                 assertion.status === 'failed' ? 'failed' : 'skipped',
        error: assertion.error?.message || '',
        failureMessage: assertion.failureMessages?.join('\n') || '',
      });
    }
  }

  return results;
}

async function uploadResults(options) {
  console.log('🚀 Starting Kiwi TCMS upload via XML-RPC...');

  // Load configuration
  let config;
  try {
    const configPath = path.join(process.cwd(), 'config', 'kiwi-tcms.json');
    const configFile = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(configFile);
    console.log(`✓ Loaded configuration from ${configPath}`);
  } catch (error) {
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

  config.verbose = options.verbose;

  // Load test results
  const results = loadVitestResults(options.file);
  console.log(`✓ Loaded ${results.length} test results`);

  // Calculate statistics
  const passed = results.filter(r => r.outcome === 'passed').length;
  const failed = results.filter(r => r.outcome === 'failed').length;
  const skipped = results.filter(r => r.outcome === 'skipped').length;
  const passRate = ((passed / results.length) * 100).toFixed(2);

  console.log(`\n📊 Test Statistics:`);
  console.log(`   Total: ${results.length}`);
  console.log(`   Passed: ${passed} (${passRate}%)`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Skipped: ${skipped}`);

  // Create uploader instance
  const uploader = new KiwiTCMSUploader(config);


  // Get Product
  console.log('Looking up product...');
  const product = await uploader.client.findProductByName(config.defaultProduct);
  if (!product) {
    console.error(`✗ Product not found: ${config.defaultProduct}`);
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
  const buildId = await uploader.getOrCreateBuild(product.id);

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

// Parse command-line arguments
const args = process.argv.slice(2);
const fileFlagIndex = args.indexOf('--file');
const file = fileFlagIndex !== -1 ? args[fileFlagIndex + 1] : args[0] || 'vitest-results.json';
const testPlanIdFlagIndex = args.indexOf('--test-plan-id');
const testPlanId = testPlanIdFlagIndex !== -1 ? parseInt(args[testPlanIdFlagIndex + 1]) : undefined;
const verbose = args.includes('--verbose');

uploadResults({ file, testPlanId, verbose })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  });