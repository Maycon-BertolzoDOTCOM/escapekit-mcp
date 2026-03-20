/**
 * Audit command - Analyzes escape.json files and generates reports
 *
 * Reads escape.json protocol files and generates professional reports
 * in Markdown (for PRs) or HTML (for consulting engagements).
 *
 * @module commands/audit
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { EscapeJson } from '../models/escape-json-schema.js';
import { MarkdownGenerator } from '../audit/markdown-generator.js';
import { HtmlGenerator } from '../audit/html-generator.js';

export type OutputFormat = 'markdown' | 'html' | 'json' | 'terminal';

export interface AuditOptions {
  /** Path to escape.json file */
  file?: string;
  /** Output format */
  format?: OutputFormat;
  /** Output file path (if not specified, prints to stdout) */
  output?: string;
  /** Include Kiwi TCMS details */
  includeKiwiDetails?: boolean;
  /** Include charts (HTML format only) */
  withCharts?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Execute audit command on escape.json file.
 *
 * @param options - Audit options
 * @returns Generated report content
 */
export async function auditCommand(options: AuditOptions = {}): Promise<string> {
  const {
    file = './escape.json',
    format = 'markdown',
    output,
    includeKiwiDetails = false,
    withCharts = false,
    verbose = false,
  } = options;

  // Resolve file path
  const filePath = resolve(file);

  // Check if file exists
  if (!existsSync(filePath)) {
    throw new Error(`escape.json not found at: ${filePath}`);
  }

  // Read escape.json
  let escapeJson: EscapeJson;
  try {
    const content = readFileSync(filePath, 'utf-8');
    escapeJson = JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse escape.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Validate structure (basic)
  if (!escapeJson.escapeId || !escapeJson.version) {
    throw new Error('Invalid escape.json: missing required fields (escapeId, version)');
  }

  // Generate report based on format
  let report: string;
  switch (format) {
    case 'markdown': {
      const markdownGen = new MarkdownGenerator();
      report = markdownGen.generate(escapeJson, { includeKiwiDetails, verbose });
      break;
    }
    case 'html': {
      const htmlGen = new HtmlGenerator();
      report = htmlGen.generate(escapeJson, { includeKiwiDetails, withCharts, verbose });
      break;
    }
    case 'json':
      report = JSON.stringify(escapeJson, null, 2);
      break;
    case 'terminal':
      report = generateTerminalReport(escapeJson, { includeKiwiDetails, verbose });
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  // Write to file or return
  if (output) {
    const { writeFile } = await import('fs/promises');
    await writeFile(output, report, 'utf-8');
    console.log(`✅ Report generated: ${output}`);
  }

  return report;
}

/**
 * Generate terminal-friendly report.
 */
function generateTerminalReport(escapeJson: EscapeJson, options: { includeKiwiDetails?: boolean; verbose?: boolean }): string {
  const lines: string[] = [];

  // Header
  lines.push('╔══════════════════════════════════════════════════════════╗');
  lines.push('║                  ESCAPEKIT AUDIT REPORT                      ║');
  lines.push('╚══════════════════════════════════════════════════════════╝');
  lines.push('');

  // Basic info
  lines.push('📋 Overview');
  lines.push(`   Escape ID: ${escapeJson.escapeId}`);
  lines.push(`   Version: ${escapeJson.version}`);
  lines.push(`   Timestamp: ${escapeJson.timestamp}`);
  lines.push('');

  // Provenance
  lines.push('🔍 Provenance');
  lines.push(`   Sandbox: ${escapeJson.provenance.sandbox || 'unknown'}`);
  lines.push(`   Source Hash: ${escapeJson.provenance.sourceHash || 'N/A'}`);
  lines.push(`   Files: ${escapeJson.provenance.files.length}`);
  lines.push('');

  // Analysis
  lines.push('📊 Analysis');
  lines.push(`   Issues: ${escapeJson.analysis.totalIssues}`);
  lines.push(`   Confidence Score: ${(escapeJson.analysis.confidenceScore * 100).toFixed(1)}%`);
  if (escapeJson.analysis.issues.length > 0) {
    lines.push(`   Issue Types:`);
    const breakdown = escapeJson.analysis.issueBreakdown;
    if (breakdown.ghostImports > 0) lines.push(`      - Ghost Imports: ${breakdown.ghostImports}`);
    if (breakdown.mockApis > 0) lines.push(`      - Mock APIs: ${breakdown.mockApis}`);
    if (breakdown.securityRisks > 0) lines.push(`      - Security Risks: ${breakdown.securityRisks}`);
  }
  lines.push('');

  // Transformations
  lines.push('🔧 Transformations');
  lines.push(`   Applied: ${escapeJson.transformations.totalTransformations}`);
  if (escapeJson.transformations.applied.length > 0 && options.verbose) {
    lines.push(`   Details:`);
    for (const transform of escapeJson.transformations.applied.slice(0, 3)) {
      lines.push(`      - ${transform.type}: ${transform.reason.substring(0, 50)}...`);
    }
  }
  lines.push('');

  // Validations
  lines.push('✅ Validations');
  lines.push(`   Status: ${escapeJson.validations.overallStatus.toUpperCase()}`);
  if (escapeJson.validations.kiwiTestRunId && options.includeKiwiDetails) {
    lines.push(`   Kiwi TCMS Test Run ID: ${escapeJson.validations.kiwiTestRunId}`);
    if (escapeJson.validations.testResults) {
      const tr = escapeJson.validations.testResults;
      lines.push(`   Test Results: ${tr.passed}/${tr.total} passed (${tr.passRate.toFixed(1)}%)`);
    }
  }
  lines.push('');

  // Deployment
  lines.push('🚀 Deployment');
  lines.push(`   Status: ${escapeJson.deployment.status}`);
  if (escapeJson.deployment.environment) lines.push(`   Environment: ${escapeJson.deployment.environment}`);
  if (escapeJson.deployment.url) lines.push(`   URL: ${escapeJson.deployment.url}`);
  lines.push('');

  // Sovereignty
  lines.push('🇨🇳 Sovereignty');
  lines.push(`   Compliant: ${escapeJson.sovereignty.compliant ? '✅ Yes' : '❌ No'}`);
  lines.push(`   Compliance Score: ${escapeJson.sovereignty.complianceScore}/100`);
  lines.push('');

  // Metadata
  lines.push('📦 Metadata');
  if (escapeJson.metadata.projectName) lines.push(`   Project: ${escapeJson.metadata.projectName}`);
  if (escapeJson.metadata.author) lines.push(`   Author: ${escapeJson.metadata.author}`);
  if (escapeJson.metadata.tags && escapeJson.metadata.tags.length > 0) {
    lines.push(`   Tags: ${escapeJson.metadata.tags.join(', ')}`);
  }
  lines.push('');

  return lines.join('\n');
}
