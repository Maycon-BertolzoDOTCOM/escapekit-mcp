#!/usr/bin/env tsx
import { VitestAdapter } from '../src/adapters/vitest-adapter';
import { MochaAdapter } from '../src/adapters/mocha-adapter';
import { CustomTestParser } from '../src/adapters/custom-parser';
import { TestResult } from '../src/adapters/index';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface LoadTestResultsOptions {
  framework?: 'vitest' | 'mocha' | 'custom';
  source: string;
  adapterConfig?: any;
}

/**
 * Load test results from a file or string
 * Supports Vitest, Mocha, and custom formats
 */
export async function loadTestResults(options: LoadTestResultsOptions): Promise<TestResult[]> {
  const { framework, source, adapterConfig = {} } = options;

  // Auto-detect framework if not specified
  let detectedFramework = framework;
  if (!detectedFramework) {
    detectedFramework = detectFramework(source);
    console.log(`Auto-detected framework: ${detectedFramework}`);
  }

  // Use appropriate adapter
  switch (detectedFramework) {
    case 'vitest': {
      const adapter = new VitestAdapter(adapterConfig);
      return adapter.load(source);
    }
    case 'mocha': {
      const adapter = new MochaAdapter(adapterConfig);
      return adapter.load(source);
    }
    case 'custom': {
      const adapter = new CustomTestParser(adapterConfig);
      return adapter.load(source);
    }
    default:
      throw new Error(`Unsupported framework: ${detectedFramework}`);
  }
}

/**
 * Auto-detect the test framework from a source (file path or string)
 */
export function detectFramework(source: string): 'vitest' | 'mocha' | 'custom' {
  let content: string;
  let isFile = false;

  // Read file if source is a file path
  if (existsSync(source)) {
    try {
      content = readFileSync(source, 'utf-8');
      isFile = true;
    } catch {
      return 'custom';
    }
  } else {
    content = source;
  }

  // Check for Mocha XML format first (most specific)
  if (content.includes('<testsuite') || content.includes('<testsuites')) {
    return 'mocha';
  }

  // Check for custom JSON format (has explicit framework field)
  if (content.startsWith('{') || (isFile && source.endsWith('.json'))) {
    try {
      const data = JSON.parse(content);
      if (data.framework && Array.isArray(data.tests)) {
        return 'custom';
      }
      if (data.testResults || data.testFiles || data.vitest) {
        return 'vitest';
      }
    } catch {
      // Not valid JSON, continue to other checks
    }
  }

  // Check for file extension
  if (isFile) {
    if (source.endsWith('.json')) {
      return 'vitest';
    }
    if (source.endsWith('.xml')) {
      return 'mocha';
    }
  } else if (source.endsWith('.json')) {
    return 'vitest';
  } else if (source.endsWith('.xml')) {
    return 'mocha';
  }

  // Default to custom format
  return 'custom';
}

/**
 * Load multiple test result files
 */
export async function loadMultipleTestResults(
  sources: string[],
  options?: Omit<LoadTestResultsOptions, 'source'>
): Promise<TestResult[]> {
  const allResults: TestResult[] = [];

  for (const source of sources) {
    try {
      const results = await loadTestResults({ ...options, source });
      allResults.push(...results);
      console.log(`Loaded ${results.length} tests from ${source}`);
    } catch (error) {
      console.error(`Failed to load ${source}:`, error);
      throw error;
    }
  }

  return allResults;
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: tsx scripts/load-test-results.ts <source> [--framework vitest|mocha|custom]');
    process.exit(1);
  }

  const source = args[0];
  const frameworkFlag = args.indexOf('--framework');
  const framework = frameworkFlag !== -1 ? args[frameworkFlag + 1] as any : undefined;

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