/**
 * CLIReporter - Formats validation results for terminal output
 *
 * @module validate/reporters/CLIReporter
 */

import type { ValidationResult, Reporter } from '../types.js';

export class CLIReporter implements Reporter {
  async report(result: ValidationResult): Promise<void> {
    const lines: string[] = [];

    // Header
    lines.push('');
    lines.push('╔══════════════════════════════════════════════════════════╗');
    lines.push('║              ESCAPEKIT VALIDATION REPORT                ║');
    lines.push('╚══════════════════════════════════════════════════════════╝');
    lines.push('');

    // Overall result
    const statusIcon = result.canDeploy ? '✅' : '❌';
    lines.push(`${statusIcon} Can Deploy: ${result.canDeploy ? 'YES' : 'NO'}`);
    lines.push(`📊 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    lines.push(`⏱️  Duration: ${(result.duration / 1000).toFixed(1)}s`);
    lines.push('');

    // Build check
    lines.push('🔨 Build Check');
    const buildIcon = result.checks.build.passed ? '✅' : '❌';
    lines.push(`   ${buildIcon} ${result.checks.build.passed ? 'PASSED' : 'FAILED'}`);
    lines.push(`   Install: ${(result.checks.build.installTime / 1000).toFixed(1)}s`);
    lines.push(`   Build: ${(result.checks.build.buildTime / 1000).toFixed(1)}s`);
    if (result.checks.build.bundleSize) {
      const sizeKB = (result.checks.build.bundleSize / 1024).toFixed(0);
      lines.push(`   Bundle: ${sizeKB}KB`);
    }
    if (result.checks.build.errors.length > 0) {
      lines.push('   Errors:');
      result.checks.build.errors.forEach(e => {
        lines.push(`     ❌ ${e.message}`);
      });
    }
    if (result.checks.build.warnings.length > 0) {
      lines.push('   Warnings:');
      result.checks.build.warnings.slice(0, 5).forEach(w => {
        lines.push(`     ⚠️  ${w}`);
      });
    }
    lines.push('');

    // Runtime check
    lines.push('🚀 Runtime Check');
    const runtimeIcon = result.checks.runtime.passed ? '✅' : '❌';
    lines.push(`   ${runtimeIcon} ${result.checks.runtime.passed ? 'PASSED' : 'FAILED'}`);
    lines.push(`   Startup: ${(result.checks.runtime.startupTime / 1000).toFixed(1)}s`);
    if (result.checks.runtime.healthChecks.length > 0) {
      result.checks.runtime.healthChecks.forEach(h => {
        const icon = h.passed ? '✅' : '❌';
        lines.push(`   ${icon} ${h.name}: ${h.message}`);
      });
    }
    lines.push('');

    // Dependency check
    lines.push('📦 Dependency Check');
    const depIcon = result.checks.dependencies.passed ? '✅' : '❌';
    lines.push(`   ${depIcon} ${result.checks.dependencies.passed ? 'PASSED' : 'FAILED'}`);
    if (result.checks.dependencies.ghostPackages.length > 0) {
      lines.push('   Ghost packages:');
      result.checks.dependencies.ghostPackages.forEach(g => {
        const repl = g.suggestedReplacement ? ` → ${g.suggestedReplacement}` : '';
        lines.push(`     👻 ${g.name}${repl}`);
      });
    }
    if (result.checks.dependencies.vulnerabilities.length > 0) {
      lines.push('   Vulnerabilities:');
      result.checks.dependencies.vulnerabilities.slice(0, 5).forEach(v => {
        const icon = v.severity === 'critical' ? '🔴' : v.severity === 'high' ? '🟠' : '🟡';
        lines.push(`     ${icon} [${v.severity}] ${v.name}: ${v.title}`);
      });
    }
    if (result.checks.dependencies.missingPeerDeps.length > 0) {
      lines.push('   Missing peer deps:');
      result.checks.dependencies.missingPeerDeps.slice(0, 3).forEach(d => {
        lines.push(`     ⚠️  ${d}`);
      });
    }
    lines.push('');

    // WebGL check
    if (result.checks.webgl) {
      lines.push('🎮 WebGL Check');
      const webglIcon = result.checks.webgl.passed ? '✅' : '❌';
      lines.push(`   ${webglIcon} ${result.checks.webgl.passed ? 'PASSED' : 'FAILED'}`);
      lines.push(`   Canvas: ${result.checks.webgl.hasCanvas ? 'Yes' : 'No'}`);
      lines.push(`   WebGL: ${result.checks.webgl.hasWebGL ? 'Yes' : 'No'}`);
      lines.push(`   Fallback: ${result.checks.webgl.fallbackApplied ? 'Active' : 'N/A'}`);
      lines.push('');
    }

    // Fixes applied
    if (result.fixesApplied.length > 0) {
      lines.push('🔧 Fixes Applied');
      result.fixesApplied.forEach(f => {
        const icon = f.applied ? '✅' : '❌';
        lines.push(`   ${icon} ${f.description}`);
      });
      lines.push('');
    }

    // Remaining issues
    if (result.remainingIssues.length > 0) {
      lines.push('⚠️  Remaining Issues');
      result.remainingIssues.forEach(issue => {
        const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        lines.push(`   ${icon} ${issue.message}`);
        if (issue.suggestion) {
          lines.push(`      💡 ${issue.suggestion}`);
        }
      });
      lines.push('');
    }

    // Recommendations
    if (result.recommendations.length > 0) {
      lines.push('💡 Recommendations');
      result.recommendations.forEach(r => {
        lines.push(`   • ${r}`);
      });
      lines.push('');
    }

    process.stdout.write(lines.join('\n') + '\n');
  }
}
