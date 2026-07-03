/**
 * Markdown Generator - Generates Markdown reports from escape.json
 *
 * Creates professional Markdown reports suitable for:
 * - Pull Request descriptions
 * - Documentation
 * - Technical reviews
 *
 * @module audit/markdown-generator
 */

import type { EscapeJson } from '../models/escape-json-schema.js';

export interface MarkdownGeneratorOptions {
  /** Include Kiwi TCMS details */
  includeKiwiDetails?: boolean;
  /** Verbose output with more details */
  verbose?: boolean;
}

/**
 * Generates Markdown reports from escape.json data.
 */
export class MarkdownGenerator {
  /**
   * Generate Markdown report.
   *
   * @param escapeJson - Parsed escape.json data
   * @param options - Generation options
   * @returns Markdown formatted report
   */
  generate(escapeJson: EscapeJson, options: MarkdownGeneratorOptions = {}): string {
    const { includeKiwiDetails = false } = options;

    const lines: string[] = [];

    // Header
    lines.push('# EscapeKit Audit Report');
    lines.push('');
    lines.push(`**Generated:** ${new Date(escapeJson.timestamp).toLocaleString()}`);
    lines.push(`**Escape ID:** \`${escapeJson.escapeId}\``);
    lines.push(`**Protocol Version:** ${escapeJson.version}`);
    lines.push('');

    // Table of Contents
    lines.push('## Table of Contents');
    lines.push('');
    lines.push('- [Overview](#overview)');
    lines.push('- [Provenance](#provenance)');
    lines.push('- [Analysis](#analysis)');
    lines.push('- [Transformations](#transformations)');
    lines.push('- [Validations](#validations)');
    lines.push('- [Deployment](#deployment)');
    lines.push('- [Sovereignty](#sovereignty)');
    lines.push('- [Metadata](#metadata)');
    lines.push('');

    // Overview
    lines.push('## Overview');
    lines.push('');
    lines.push('### Quick Summary');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total Issues | ${escapeJson.analysis.totalIssues} |`);
    lines.push(`| Confidence Score | ${escapeJson.analysis.confidenceScore.toFixed(1)}% |`);
    lines.push(`| Transformations Applied | ${escapeJson.transformations.totalTransformations} |`);
    lines.push(`| Validation Status | ${escapeJson.validations.overallStatus.toUpperCase()} |`);
    lines.push('');

    // Provenance
    lines.push('## Provenance');
    lines.push('');
    lines.push('### Source Information');
    lines.push('');
    lines.push('- **Sandbox Type:** ' + (escapeJson.provenance.sandbox || 'unknown'));
    lines.push('- **Source Hash:** `' + (escapeJson.provenance.sourceHash || 'N/A') + '`');
    lines.push(
      '- **Detection Date:** ' + new Date(escapeJson.provenance.detectedAt).toLocaleString()
    );
    lines.push('');

    if (escapeJson.provenance.files.length > 0) {
      lines.push('### Files Analyzed');
      lines.push('');
      lines.push('| File | Type | Size |');
      lines.push('|------|------|------|');
      for (const file of escapeJson.provenance.files.slice(0, 10)) {
        lines.push(`| ${file.path} | ${file.type} | ${file.size} |`);
      }
      if (escapeJson.provenance.files.length > 10) {
        lines.push(`| ... and ${escapeJson.provenance.files.length - 10} more | | |`);
      }
      lines.push('');
    }

    // Analysis
    lines.push('## Analysis');
    lines.push('');
    lines.push('### Analysis Configuration');
    lines.push('');
    lines.push('- **Analysis ID:** `' + escapeJson.analysis.analysisId + '`');
    lines.push('- **EscapeKit Version:** ' + escapeJson.analysis.escapeKitVersion);
    lines.push('- **Target Platform:** ' + escapeJson.analysis.config.targetPlatform);
    lines.push('- **Target Runtime:** ' + escapeJson.analysis.config.targetRuntime);
    lines.push('- **Strictness Level:** ' + escapeJson.analysis.config.strictness);
    lines.push(
      '- **Chinese Mirrors:** ' +
        (escapeJson.analysis.config.useChineseMirrors ? '✅ Enabled' : '❌ Disabled')
    );
    lines.push('');

    // Issues
    lines.push('### Issues Detected');
    lines.push('');
    if (escapeJson.analysis.issues.length === 0) {
      lines.push('✅ No issues detected.');
    } else {
      lines.push('| Type | Severity | File | Line | Message | Academic Ref |');
      lines.push('|------|----------|------|------|---------|--------------|');
      for (const issue of escapeJson.analysis.issues) {
        const severityEmoji =
          issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        let academicRef = 'N/A';
        if (issue.academicReference) {
          const ref = issue.academicReference;
          if (ref.doi) {
            academicRef = `[${ref.title}](https://doi.org/${ref.doi})`;
          } else if (ref.url) {
            academicRef = `[${ref.title}](${ref.url})`;
          } else {
            academicRef = `${ref.title} (${ref.year})`;
          }
        }
        lines.push(
          `| ${issue.type} | ${severityEmoji} ${issue.severity} | ${issue.filePath || 'N/A'} | ${issue.line} | ${issue.message.substring(0, 60)}... | ${academicRef} |`
        );
      }
    }
    lines.push('');

    // Issue Breakdown
    lines.push('### Issue Breakdown');
    lines.push('');
    const breakdown = escapeJson.analysis.issueBreakdown;
    const totalIssues = escapeJson.analysis.totalIssues;

    if (totalIssues > 0) {
      lines.push('| Issue Type | Count | Percentage |');
      lines.push('|-----------|-------|------------|');
      if (breakdown.ghostImports > 0) {
        lines.push(
          `| Ghost Imports | ${breakdown.ghostImports} | ${((breakdown.ghostImports / totalIssues) * 100).toFixed(1)}% |`
        );
      }
      if (breakdown.mockApis > 0) {
        lines.push(
          `| Mock APIs | ${breakdown.mockApis} | ${((breakdown.mockApis / totalIssues) * 100).toFixed(1)}% |`
        );
      }
      if (breakdown.sandboxApis > 0) {
        lines.push(
          `| Sandbox APIs | ${breakdown.sandboxApis} | ${((breakdown.sandboxApis / totalIssues) * 100).toFixed(1)}% |`
        );
      }
      if (breakdown.securityRisks > 0) {
        lines.push(
          `| Security Risks | ${breakdown.securityRisks} | ${((breakdown.securityRisks / totalIssues) * 100).toFixed(1)}% |`
        );
      }
      if (breakdown.unrealisticAssumptions > 0) {
        lines.push(
          `| Unrealistic Assumptions | ${breakdown.unrealisticAssumptions} | ${((breakdown.unrealisticAssumptions / totalIssues) * 100).toFixed(1)}% |`
        );
      }
    } else {
      lines.push('✅ No issues to break down.');
    }
    lines.push('');

    // Transformations
    lines.push('## Transformations');
    lines.push('');
    lines.push('### Summary');
    lines.push('');
    lines.push('- **Total Transformations:** ' + escapeJson.transformations.totalTransformations);
    lines.push(
      '- **Transformation Date:** ' +
        new Date(escapeJson.transformations.transformedAt).toLocaleString()
    );
    lines.push('');

    if (escapeJson.transformations.applied.length > 0) {
      lines.push('### Applied Transformations');
      lines.push('');
      lines.push('| Type | File | Reason | Package Used |');
      lines.push('|------|------|--------|--------------|');
      for (const transform of escapeJson.transformations.applied) {
        const reason = transform.reason ? transform.reason.substring(0, 50) : 'N/A';
        lines.push(
          `| ${transform.type} | ${transform.filePath || 'N/A'} | ${reason}... | ${transform.packageUsed || 'N/A'} |`
        );
      }
      lines.push('');

      // Transformation Breakdown
      const tBreakdown = escapeJson.transformations.breakdown;
      const totalTrans = escapeJson.transformations.totalTransformations;

      if (totalTrans > 0) {
        lines.push('### Transformation Breakdown');
        lines.push('');
        lines.push('| Transformation Type | Count |');
        lines.push('|-------------------|-------|');
        if (tBreakdown.importReplacements > 0) {
          lines.push(`| Import Replacements | ${tBreakdown.importReplacements} |`);
        }
        if (tBreakdown.apiReplacements > 0) {
          lines.push(`| API Replacements | ${tBreakdown.apiReplacements} |`);
        }
        if (tBreakdown.polyfillAdditions > 0) {
          lines.push(`| Polyfill Additions | ${tBreakdown.polyfillAdditions} |`);
        }
        if (tBreakdown.fallbackImplementations > 0) {
          lines.push(`| Fallback Implementations | ${tBreakdown.fallbackImplementations} |`);
        }
        lines.push('');
      }
    } else {
      lines.push('✅ No transformations applied.');
      lines.push('');
    }

    // Validations
    lines.push('## Validations');
    lines.push('');
    lines.push('### Overall Status');
    lines.push('');
    const statusEmoji =
      escapeJson.validations.overallStatus === 'passed'
        ? '✅'
        : escapeJson.validations.overallStatus === 'failed'
          ? '❌'
          : '⚠️';
    lines.push(`${statusEmoji} **Status:** ${escapeJson.validations.overallStatus.toUpperCase()}`);
    lines.push('');
    lines.push('- **Total Validations:** ' + escapeJson.validations.totalValidations);
    lines.push('- **Passed Validations:** ' + escapeJson.validations.passedValidations);
    lines.push('- **Failed Validations:** ' + escapeJson.validations.failedValidations);
    lines.push('');

    // Kiwi TCMS
    if (escapeJson.validations.kiwiTestRunId && includeKiwiDetails) {
      lines.push('### Kiwi TCMS Integration');
      lines.push('');
      lines.push('- **Test Run ID:** ' + escapeJson.validations.kiwiTestRunId);
      if (escapeJson.validations.testResults) {
        const tr = escapeJson.validations.testResults;
        lines.push('- **Test Framework:** ' + tr.framework);
        lines.push('- **Total Tests:** ' + tr.total);
        lines.push('- **Passed:** ' + tr.passed);
        lines.push('- **Failed:** ' + tr.failed);
        lines.push('- **Skipped:** ' + tr.skipped);
        lines.push('- **Pass Rate:** ' + tr.passRate.toFixed(2) + '%');
        lines.push('- **Executed At:** ' + new Date(tr.executedAt).toLocaleString());
      }
      lines.push('');
    }

    // Deployment
    lines.push('## Deployment');
    lines.push('');
    lines.push('### Status');
    lines.push('');
    lines.push('- **Deployment Status:** ' + escapeJson.deployment.status);
    if (escapeJson.deployment.environment) {
      lines.push('- **Environment:** ' + escapeJson.deployment.environment);
    }
    if (escapeJson.deployment.target) {
      lines.push('- **Target Platform:** ' + escapeJson.deployment.target);
    }
    if (escapeJson.deployment.url) {
      lines.push('- **Deployment URL:** ' + escapeJson.deployment.url);
    }
    if (escapeJson.deployment.deployedAt) {
      lines.push(
        '- **Deployment Date:** ' + new Date(escapeJson.deployment.deployedAt).toLocaleString()
      );
    }
    lines.push('');

    // Sovereignty
    lines.push('## Sovereignty');
    lines.push('');
    lines.push('### Compliance Status');
    lines.push('');
    const complianceEmoji = escapeJson.sovereignty.compliant ? '✅' : '❌';
    lines.push(
      `${complianceEmoji} **Compliant:** ${escapeJson.sovereignty.compliant ? 'Yes' : 'No'}`
    );
    lines.push('');
    lines.push('- **Compliance Score:** ' + escapeJson.sovereignty.complianceScore + '/100');
    lines.push(
      '- **Last Checked:** ' + new Date(escapeJson.sovereignty.checkedAt).toLocaleString()
    );
    lines.push('');
    lines.push('### Self-Reliance Features');
    lines.push('');
    lines.push(
      '- **Chinese Mirrors:** ' +
        (escapeJson.sovereignty.chineseMirrors ? '✅ Enabled' : '❌ Disabled')
    );
    lines.push(
      '- **Offline Cache:** ' + (escapeJson.sovereignty.offlineCache ? '✅ Enabled' : '❌ Disabled')
    );
    lines.push(
      '- **Security Validation:** ' +
        (escapeJson.sovereignty.securityValidation ? '✅ Enabled' : '❌ Disabled')
    );
    lines.push(
      '- **Audit Logging:** ' + (escapeJson.sovereignty.auditLogging ? '✅ Enabled' : '❌ Disabled')
    );
    if (escapeJson.sovereignty.packageReplacements.length > 0) {
      lines.push('- **Package Replacements:**');
      for (const replacement of escapeJson.sovereignty.packageReplacements) {
        lines.push(`  - ${replacement.original} → ${replacement.replacedWith}`);
      }
    }
    lines.push('');

    // Metadata
    lines.push('## Metadata');
    lines.push('');
    lines.push('### Project Information');
    lines.push('');
    if (escapeJson.metadata.projectName) {
      lines.push('- **Project Name:** ' + escapeJson.metadata.projectName);
    }
    if (escapeJson.metadata.projectDescription) {
      lines.push('- **Description:** ' + escapeJson.metadata.projectDescription);
    }
    if (escapeJson.metadata.projectVersion) {
      lines.push('- **Version:** ' + escapeJson.metadata.projectVersion);
    }
    if (escapeJson.metadata.author) {
      lines.push('- **Author:** ' + escapeJson.metadata.author);
    }
    if (escapeJson.metadata.organization) {
      lines.push('- **Organization:** ' + escapeJson.metadata.organization);
    }
    if (escapeJson.metadata.tags && escapeJson.metadata.tags.length > 0) {
      lines.push('- **Tags:** ' + escapeJson.metadata.tags.join(', '));
    }
    lines.push('');

    // Custom Fields
    if (
      escapeJson.metadata.customFields &&
      Object.keys(escapeJson.metadata.customFields).length > 0
    ) {
      lines.push('### Custom Fields');
      lines.push('');
      for (const [key, value] of Object.entries(escapeJson.metadata.customFields)) {
        lines.push(`- **${key}:** ${value}`);
      }
      lines.push('');
    }

    // Footer
    lines.push('---');
    lines.push('');
    lines.push(
      '*This report was generated by [EscapeKit](https://github.com/escapekit/escapekit-mcp)*'
    );
    lines.push('*Protocol Version: ' + escapeJson.version + '*');

    return lines.join('\n');
  }
}
