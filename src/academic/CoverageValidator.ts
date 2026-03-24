/**
 * CoverageValidator — Validates YAML contract coverage against detector implementations.
 *
 * Pure class: `validate()` takes contracts in memory and returns a report.
 * No I/O. Formatting methods produce terminal and Markdown output.
 *
 * @module academic/CoverageValidator
 */

import type { ContratoYAML, ContractCoverage, CoverageReport } from '../models/academic.js';

export class CoverageValidator {
  /**
   * Validate coverage across an array of YAML contracts.
   *
   * For each contract, counts rules and facts, checks traceability entries,
   * and identifies gaps (IDs with no traceability entry).
   *
   * @param contracts - Array of parsed ContratoYAML objects
   * @returns CoverageReport with per-contract and aggregate statistics
   */
  validate(contracts: ContratoYAML[]): CoverageReport {
    if (contracts.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        contracts: [],
        totalRules: 0,
        totalFacts: 0,
        totalImplemented: 0,
        coveragePercentage: 0.0,
      };
    }

    const contractReports: ContractCoverage[] = [];
    let grandTotalRules = 0;
    let grandTotalFacts = 0;
    let grandTotalImplemented = 0;

    for (const contract of contracts) {
      const paperId = (contract.metadata?.paperId as string) ?? contract.source?.title ?? 'unknown';
      const contractFile = (contract.metadata?.contractFile as string) ?? '';

      const rules = contract.rules ?? [];
      const facts = contract.facts ?? [];
      const traceability = contract.traceability ?? {};

      const totalRules = rules.length;
      const totalFacts = facts.length;

      const allIds = [...rules.map(r => r.id), ...facts.map(f => f.id)];
      const tracedIds = Object.keys(traceability);

      let implementedCount = 0;
      let pendingCount = 0;
      const gaps: string[] = [];

      for (const id of allIds) {
        if (!Object.prototype.hasOwnProperty.call(traceability, id)) {
          gaps.push(id);
        } else {
          const entry = traceability[id];
          if (entry.status === 'implemented') {
            implementedCount++;
          } else if (entry.status === 'pending') {
            pendingCount++;
          }
        }
      }

      const missingCount = allIds.filter(id => !tracedIds.includes(id)).length;

      contractReports.push({
        paperId,
        contractFile,
        totalRules,
        totalFacts,
        implementedCount,
        pendingCount,
        missingCount,
        gaps,
      });

      grandTotalRules += totalRules;
      grandTotalFacts += totalFacts;
      grandTotalImplemented += implementedCount;
    }

    const total = grandTotalRules + grandTotalFacts;
    const coveragePercentage =
      total === 0 ? 0.0 : Math.round((grandTotalImplemented / total) * 1000) / 10;

    return {
      generatedAt: new Date().toISOString(),
      contracts: contractReports,
      totalRules: grandTotalRules,
      totalFacts: grandTotalFacts,
      totalImplemented: grandTotalImplemented,
      coveragePercentage,
    };
  }

  /**
   * Format a CoverageReport as a human-readable terminal string.
   *
   * @param report - The coverage report to format
   * @returns Formatted string for terminal output
   */
  formatReport(report: CoverageReport): string {
    const lines: string[] = [];

    lines.push('📊 Academic Paper Coverage Report');
    lines.push(`   Generated: ${report.generatedAt}`);
    lines.push('');

    if (report.contracts.length === 0) {
      lines.push('   No contracts loaded.');
      return lines.join('\n');
    }

    for (const c of report.contracts) {
      lines.push(`📄 ${c.paperId} (${c.contractFile})`);
      lines.push(`   Rules: ${c.totalRules} | Facts: ${c.totalFacts}`);
      lines.push(`   Implemented: ${c.implementedCount} | Pending: ${c.pendingCount} | Missing: ${c.missingCount}`);
      if (c.gaps.length > 0) {
        lines.push('   Gaps:');
        for (const gap of c.gaps) {
          lines.push(`     [${c.paperId}] ${gap}: sem implementação registrada`);
        }
      }
      lines.push('');
    }

    lines.push('─'.repeat(60));
    lines.push(`Total Rules: ${report.totalRules} | Total Facts: ${report.totalFacts}`);
    lines.push(`Total Implemented: ${report.totalImplemented}`);

    if (report.coveragePercentage === 100.0) {
      lines.push('✅ Cobertura completa: 100% dos fatos e regras possuem implementação registrada.');
    } else {
      lines.push(`Coverage: ${report.coveragePercentage.toFixed(1)}%`);
    }

    return lines.join('\n');
  }

  /**
   * Format a CoverageReport as a Markdown string for file output.
   *
   * @param report - The coverage report to format
   * @returns Markdown-formatted string
   */
  formatMarkdown(report: CoverageReport): string {
    const lines: string[] = [];

    lines.push('# Academic Paper Coverage Report');
    lines.push('');
    lines.push(`**Generated:** ${report.generatedAt}`);
    lines.push('');

    if (report.contracts.length === 0) {
      lines.push('_No contracts loaded._');
      return lines.join('\n');
    }

    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Rules | ${report.totalRules} |`);
    lines.push(`| Total Facts | ${report.totalFacts} |`);
    lines.push(`| Total Implemented | ${report.totalImplemented} |`);
    lines.push(`| Coverage | ${report.coveragePercentage.toFixed(1)}% |`);
    lines.push('');

    lines.push('## Per-Contract Details');
    lines.push('');

    for (const c of report.contracts) {
      lines.push(`### ${c.paperId}`);
      lines.push('');
      lines.push(`- **Contract file:** \`${c.contractFile}\``);
      lines.push(`- **Rules:** ${c.totalRules}`);
      lines.push(`- **Facts:** ${c.totalFacts}`);
      lines.push(`- **Implemented:** ${c.implementedCount}`);
      lines.push(`- **Pending:** ${c.pendingCount}`);
      lines.push(`- **Missing:** ${c.missingCount}`);
      lines.push('');

      if (c.gaps.length > 0) {
        lines.push('**Gaps:**');
        lines.push('');
        for (const gap of c.gaps) {
          lines.push(`- \`[${c.paperId}] ${gap}\`: sem implementação registrada`);
        }
        lines.push('');
      }
    }

    if (report.coveragePercentage === 100.0) {
      lines.push('> ✅ Cobertura completa: 100% dos fatos e regras possuem implementação registrada.');
    }

    return lines.join('\n');
  }
}
