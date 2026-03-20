#!/usr/bin/env tsx
import { VitestAdapter } from '../src/adapters/vitest-adapter';
import { JestAdapter } from '../src/adapters/jest-adapter';
import { MochaAdapter } from '../src/adapters/mocha-adapter';
import { PlaywrightAdapter } from '../src/adapters/playwright-adapter';
import { CypressAdapter } from '../src/adapters/cypress-adapter';
import { CustomTestParser } from '../src/adapters/custom-parser';
import { TestAdapter, TestResult } from '../src/adapters/index';
import { readFileSync } from 'fs';

export type Framework = 'vitest' | 'jest' | 'mocha' | 'playwright' | 'cypress' | 'custom';

export interface LoadTestResultsOptions {
  framework?: Framework;
  source: string;
  adapterConfig?: any;
}

/**
 * Auto-detect test framework from file content
 */
function detectFramework(source: string): Framework {
  if (source.endsWith('.json')) {
    try {
      const content = readFileSync(source, 'utf-8');
      const data = JSON.parse(content);

      // Playwright
      if (data.suites !== undefined || data.config !== undefined) {
        return 'playwright';
      }

      // Cypress
      if (
        data.browserName !== undefined ||
        (data.results !== undefined && Array.isArray(data.results) && data.results[0]?.suite)
      ) {
        return 'cypress';
      }

      // Vitest (has testResults with assertionResults or numTotalTestSuites)
      if (
        data.testResults &&
        (data.numTotalTestSuites !== undefined || data.numFailedTestSuites !== undefined)
      ) {
        return 'vitest';
      }

      // Jest (has testResults with snapshot)
      if (
        data.numTotalTests !== undefined &&
        data.testResults !== undefined &&
        data.snapshot !== undefined
      ) {
        return 'jest';
      }

      // Mocha
      if (data.stats && (data.failures !== undefined || data.passes !== undefined)) {
        return 'mocha';
      }

      // Custom array format
      if (Array.isArray(data) && data[0]?.testCase !== undefined) {
        return 'custom';
      }
    } catch {
      // Not JSON
    }
  }

  // XML detection (Mocha xunit)
  if (source.endsWith('.xml')) {
    try {
      const content = readFileSync(source, 'utf-8');
      if (content.includes('<testsuite') || content.includes('<testsuites>')) {
        return 'mocha';
      }
    } catch {
      // Not readable
    }
  }

  return 'custom';
}

/**
 * Create adapter instance for a given framework
 */
function createAdapter(framework: Framework, config: any = {}): TestAdapter {
  switch (framework) {
    case 'vitest':
      return new VitestAdapter(config);
    case 'jest':
      return new JestAdapter(config);
    case 'mocha':
      return new MochaAdapter(config);
    case 'playwright':
      return new PlaywrightAdapter(config);
    case 'cypress':
      return new CypressAdapter(config);
    case 'custom':
      return new CustomTestParser(config);
    default:
      throw new Error(`Unsupported framework: ${framework}`);
  }
}

/**
 * Load test results from a file or string
 */
export async function loadTestResults(options: LoadTestResultsOptions): Promise<TestResult[]> {
  const { framework, source, adapterConfig = {} } = options;

  const detectedFramework = framework || detectFramework(source);
  console.log(`Framework: ${detectedFramework}${framework ? '' : ' (auto-detected)'}`);

  const adapter = createAdapter(detectedFramework, adapterConfig);
  return adapter.load(source);
}

/**
 * Merge multiple test result files
 */
export async function mergeTestResults(files: string[]): Promise<TestResult[]> {
  const allResults: TestResult[] = [];
  for (const file of files) {
    const results = await loadTestResults({ source: file });
    allResults.push(...results);
  }
  return allResults;
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(
      'Usage: tsx scripts/load-test-results.ts <source> [--framework vitest|jest|mocha|playwright|cypress|custom]'
    );
    process.exit(1);
  }

  const source = args[0];
  const frameworkFlag = args.indexOf('--framework');
  const framework = frameworkFlag !== -1 ? (args[frameworkFlag + 1] as Framework) : undefined;

  loadTestResults({ source, framework })
    .then(results => {
      console.log(`\nLoaded ${results.length} test results`);
      console.log(`Passed: ${results.filter(r => r.outcome === 'passed').length}`);
      console.log(`Failed: ${results.filter(r => r.outcome === 'failed').length}`);
      console.log(`Skipped: ${results.filter(r => r.outcome === 'skipped').length}`);
      console.log(`\nTotal duration: ${results.reduce((sum, r) => sum + r.duration, 0)}ms`);
    })
    .catch(error => {
      console.error('Error loading test results:', error);
      process.exit(1);
    });
}
