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
 * Auto-detect test framework from a source (file path or string)
 */
function detectFramework(source: string): 'vitest' | 'mocha' | 'custom' {
  // Try to determine from file extension
  if (source.endsWith('.json')) {
    // Read file and check for framework-specific patterns
    try {
      const content = readFileSync(source, 'utf-8');
      
      // Debug logging
      console.log(`\n🔍 File analysis:`);
      console.log(`   File: ${source}`);
      console.log(`   Size: ${content.length} bytes`);
      console.log(`   First 100 chars: ${content.substring(0, 100)}`);
      
      const data = JSON.parse(content);
      
      console.log(`   Parsed JSON keys: ${Object.keys(data).join(', ')}`);
      console.log(`   Has testResults? ${!!data.testResults}`);
      console.log(`   Has numTotalTests? ${!!data.numTotalTests}`);
      console.log(`   Has version? ${!!data.version}`);

      // Vitest detection
      if (data.testResults || (data.numTotalTests !== undefined && data.version)) {
        console.log(`   ✓ Detected: Vitest`);
        return 'vitest';
      }

      // Mocha detection
      if (data.stats && data.stats.tests) {
        console.log(`   ✓ Detected: Mocha`);
        return 'mocha';
      }
      
      console.log(`   ⚠ Falling back to: custom`);
    } catch (error: any) {
      // Detailed error logging
      console.error(`\n✗ Error parsing JSON from ${source}:`);
      console.error(`   Message: ${error.message}`);
      if (error instanceof SyntaxError) {
        console.error(`   Position: line ${error.message.match(/line (\d+)/)?.[1]}, column ${error.message.match(/column (\d+)/)?.[1]}`);
        const content = readFileSync(source, 'utf-8');
        const lines = content.split('\n');
        if (error.message.match(/line (\d+)/)) {
          const lineNum = parseInt(error.message.match(/line (\d+)/)![1]);
          const startLine = Math.max(0, lineNum - 5);
          const endLine = Math.min(lines.length - 1, lineNum + 5);
          console.error(`   Context:`);
          for (let i = startLine; i <= endLine; i++) {
            console.error(`     ${i + 1}: ${lines[i] || ''}`);
          }
        }
      }
      console.warn(`   ⚠ Assuming custom format`);
    }
  }

  return 'custom';
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