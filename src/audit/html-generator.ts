/**
 * HTML Generator - Generates HTML reports from escape.json
 *
 * Creates professional HTML reports suitable for:
 * - Consulting engagements ($3k value)
 * - Client presentations
 * - Web-based dashboards
 *
 * @module audit/html-generator
 */

import type { EscapeJson } from '../models/escape-json-schema.js';

export interface HtmlGeneratorOptions {
  /** Include Kiwi TCMS details */
  includeKiwiDetails?: boolean;
  /** Include interactive charts */
  withCharts?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Generates HTML reports from escape.json data.
 */
export class HtmlGenerator {
  /**
   * Generate HTML report.
   *
   * @param escapeJson - Parsed escape.json data
   * @param options - Generation options
   * @returns HTML formatted report
   */
  generate(escapeJson: EscapeJson, options: HtmlGeneratorOptions = {}): string {
    const { includeKiwiDetails = false, withCharts = false, verbose = false } = options;

    return this.renderTemplate(escapeJson, { includeKiwiDetails, withCharts, verbose });
  }

  /**
   * Render HTML template with escape.json data.
   */
  private renderTemplate(escapeJson: EscapeJson, options: HtmlGeneratorOptions): string {
    const { includeKiwiDetails, withCharts } = options;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EscapeKit Audit Report - ${escapeJson.escapeId}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  ${withCharts ? this.getChartScripts() : ''}
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .status-passed { background-color: #10b981; }
    .status-failed { background-color: #ef4444; }
    .status-partial { background-color: #f59e0b; }
    .status-pending { background-color: #6b7280; }
  </style>
</head>
<body class="bg-gray-50 text-gray-900">
  <div class="max-w-6xl mx-auto px-4 py-8">
    
    <!-- Header -->
    <div class="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-8 mb-8 shadow-lg">
      <h1 class="text-4xl font-bold mb-2">EscapeKit Audit Report</h1>
      <p class="text-blue-100 mb-4">Professional analysis and transformation report</p>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        ${this.renderStatCard('Escape ID', escapeJson.escapeId, 'info')}
        ${this.renderStatCard('Version', escapeJson.version, 'info')}
        ${this.renderStatCard('Issues', escapeJson.analysis.totalIssues.toString(), 'warning')}
        ${this.renderStatCard('Confidence', (escapeJson.analysis.confidenceScore * 100).toFixed(1) + '%', 'success')}
      </div>
    </div>

    <!-- Quick Summary -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      ${this.renderSummaryCard('Transformations', String(escapeJson.transformations.totalTransformations), '🔧')}
      ${this.renderSummaryCard('Validation Status', escapeJson.validations.overallStatus.toUpperCase(), '✅')}
      ${this.renderSummaryCard('Deployment', escapeJson.deployment.status, '🚀')}
    </div>

    <!-- Provenance -->
    <div class="bg-white rounded-lg shadow-md p-6 mb-8">
      <h2 class="text-2xl font-bold mb-4 flex items-center">
        <span class="mr-2">🔍</span> Provenance
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${this.renderInfoRow('Sandbox Type', escapeJson.provenance.sandbox || 'unknown')}
        ${this.renderInfoRow('Source Hash', escapeJson.provenance.sourceHash || 'N/A', 'font-mono text-sm')}
        ${this.renderInfoRow('Detection Date', new Date(escapeJson.provenance.detectedAt).toLocaleString())}
        ${this.renderInfoRow('Files Analyzed', escapeJson.provenance.files.length.toString())}
      </div>
      
      ${escapeJson.provenance.files.length > 0 ? `
      <div class="mt-6">
        <h3 class="text-lg font-semibold mb-3">Files</h3>
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead class="bg-gray-100">
              <tr>
                <th class="px-4 py-2 text-left">Path</th>
                <th class="px-4 py-2 text-left">Type</th>
                <th class="px-4 py-2 text-right">Size</th>
              </tr>
            </thead>
            <tbody>
              ${escapeJson.provenance.files.slice(0, 10).map(file => `
                <tr class="border-t">
                  <td class="px-4 py-2 font-mono text-sm">${file.path}</td>
                  <td class="px-4 py-2"><span class="px-2 py-1 rounded text-xs ${
                    file.type === 'test' ? 'bg-green-100 text-green-800' :
                    file.type === 'config' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }">${file.type}</span></td>
                  <td class="px-4 py-2 text-right">${file.size}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}
    </div>

    <!-- Analysis -->
    <div class="bg-white rounded-lg shadow-md p-6 mb-8">
      <h2 class="text-2xl font-bold mb-4 flex items-center">
        <span class="mr-2">📊</span> Analysis
      </h2>
      
      ${withCharts ? this.renderIssueBreakdownChart(escapeJson) : this.renderIssueBreakdownTable(escapeJson)}
      
      ${escapeJson.analysis.issues.length > 0 ? `
      <div class="mt-6">
        <h3 class="text-lg font-semibold mb-3">Issues Detected</h3>
        <div class="space-y-2">
          ${escapeJson.analysis.issues.slice(0, 10).map(issue => `
            <div class="border rounded-lg p-4 ${issue.severity === 'error' ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'}">
              <div class="flex items-center justify-between mb-2">
                <span class="font-semibold">${issue.type}</span>
                <span class="px-2 py-1 rounded text-xs ${
                  issue.severity === 'error' ? 'bg-red-100 text-red-800' :
                  issue.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }">${issue.severity}</span>
              </div>
              <p class="text-sm text-gray-700">${issue.message}</p>
              ${issue.suggestion ? `<p class="text-sm text-blue-600 mt-2">💡 ${issue.suggestion}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
      ` : `
      <div class="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <p class="text-green-800 font-semibold">✅ No issues detected!</p>
      </div>
      `}
    </div>

    <!-- Transformations -->
    <div class="bg-white rounded-lg shadow-md p-6 mb-8">
      <h2 class="text-2xl font-bold mb-4 flex items-center">
        <span class="mr-2">🔧</span> Transformations
      </h2>
      
      ${escapeJson.transformations.applied.length > 0 ? `
      <div class="space-y-4">
        ${escapeJson.transformations.applied.slice(0, 10).map(transform => `
          <div class="border rounded-lg p-4 hover:shadow-md transition-shadow">
            <div class="flex items-center justify-between mb-2">
              <span class="font-semibold text-blue-600">${transform.type}</span>
              <span class="text-xs text-gray-500">${new Date(transform.timestamp).toLocaleString()}</span>
            </div>
            <p class="text-sm text-gray-700 mb-3">${transform.reason}</p>
            ${transform.packageUsed ? `
            <div class="flex items-center text-sm">
              <span class="text-gray-500 mr-2">Package:</span>
              <code class="bg-gray-100 px-2 py-1 rounded">${transform.packageUsed}</code>
            </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
      ` : `
      <div class="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p class="text-gray-800 font-semibold">No transformations applied</p>
      </div>
      `}
    </div>

    <!-- Validations -->
    <div class="bg-white rounded-lg shadow-md p-6 mb-8">
      <h2 class="text-2xl font-bold mb-4 flex items-center">
        <span class="mr-2">✅</span> Validations
      </h2>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="text-center p-4 bg-green-50 rounded-lg">
          <p class="text-3xl font-bold text-green-600">${escapeJson.validations.passedValidations}</p>
          <p class="text-sm text-green-700">Passed</p>
        </div>
        <div class="text-center p-4 bg-red-50 rounded-lg">
          <p class="text-3xl font-bold text-red-600">${escapeJson.validations.failedValidations}</p>
          <p class="text-sm text-red-700">Failed</p>
        </div>
        <div class="text-center p-4 bg-gray-50 rounded-lg">
          <p class="text-3xl font-bold text-gray-600">${escapeJson.validations.totalValidations}</p>
          <p class="text-sm text-gray-700">Total</p>
        </div>
      </div>

      ${escapeJson.validations.kiwiTestRunId && includeKiwiDetails ? `
      <div class="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 class="font-semibold text-blue-900 mb-2">Kiwi TCMS Integration</h3>
        <div class="grid grid-cols-2 gap-4">
          ${this.renderInfoRow('Test Run ID', escapeJson.validations.kiwiTestRunId.toString())}
          ${escapeJson.validations.testResults ? `
            ${this.renderInfoRow('Framework', escapeJson.validations.testResults.framework)}
            ${this.renderInfoRow('Total Tests', escapeJson.validations.testResults.total.toString())}
            ${this.renderInfoRow('Pass Rate', escapeJson.validations.testResults.passRate.toFixed(2) + '%')}
          ` : ''}
        </div>
      </div>
      ` : ''}
    </div>

    <!-- Deployment -->
    <div class="bg-white rounded-lg shadow-md p-6 mb-8">
      <h2 class="text-2xl font-bold mb-4 flex items-center">
        <span class="mr-2">🚀</span> Deployment
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${this.renderInfoRow('Status', escapeJson.deployment.status)}
        ${escapeJson.deployment.environment ? this.renderInfoRow('Environment', escapeJson.deployment.environment) : ''}
        ${escapeJson.deployment.target ? this.renderInfoRow('Target', escapeJson.deployment.target) : ''}
        ${escapeJson.deployment.url ? this.renderInfoRow('URL', escapeJson.deployment.url, 'text-blue-600 underline') : ''}
      </div>
    </div>

    <!-- Sovereignty -->
    <div class="bg-white rounded-lg shadow-md p-6 mb-8">
      <h2 class="text-2xl font-bold mb-4 flex items-center">
        <span class="mr-2">🇨🇳</span> Sovereignty
      </h2>
      
      <div class="flex items-center justify-between mb-6">
        <div>
          <p class="text-lg font-semibold">Compliance Score</p>
          <p class="text-gray-600">${escapeJson.sovereignty.complianceScore}/100</p>
        </div>
        <div class="text-4xl font-bold ${escapeJson.sovereignty.compliant ? 'text-green-600' : 'text-red-600'}">
          ${escapeJson.sovereignty.compliant ? '✅' : '❌'}
        </div>
      </div>
      
      <div class="space-y-2">
        ${this.renderFeatureItem('Chinese Mirrors', escapeJson.sovereignty.chineseMirrors)}
        ${this.renderFeatureItem('Offline Cache', escapeJson.sovereignty.offlineCache)}
        ${this.renderFeatureItem('Security Validation', escapeJson.sovereignty.securityValidation)}
        ${this.renderFeatureItem('Audit Logging', escapeJson.sovereignty.auditLogging)}
      </div>
    </div>

    <!-- Metadata -->
    <div class="bg-white rounded-lg shadow-md p-6 mb-8">
      <h2 class="text-2xl font-bold mb-4 flex items-center">
        <span class="mr-2">📦</span> Metadata
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${escapeJson.metadata.projectName ? this.renderInfoRow('Project', escapeJson.metadata.projectName) : ''}
        ${escapeJson.metadata.author ? this.renderInfoRow('Author', escapeJson.metadata.author) : ''}
        ${escapeJson.metadata.organization ? this.renderInfoRow('Organization', escapeJson.metadata.organization) : ''}
        ${escapeJson.metadata.projectVersion ? this.renderInfoRow('Version', escapeJson.metadata.projectVersion) : ''}
      </div>
      ${escapeJson.metadata.tags && escapeJson.metadata.tags.length > 0 ? `
      <div class="mt-4">
        <p class="text-sm text-gray-600 mb-2">Tags:</p>
        <div class="flex flex-wrap gap-2">
          ${escapeJson.metadata.tags.map(tag => `
            <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">${tag}</span>
          `).join('')}
        </div>
      </div>
      ` : ''}
    </div>

    <!-- Footer -->
    <div class="text-center text-gray-500 text-sm mt-8 mb-4">
      <p>Generated by <a href="https://github.com/escapekit/escapekit-mcp" class="text-blue-600 hover:underline">EscapeKit</a></p>
      <p>Protocol Version: ${escapeJson.version} | Generated: ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>`;
  }

  private renderStatCard(label: string, value: string, type: 'success' | 'warning' | 'info' | 'error'): string {
    const colors = {
      success: 'bg-white/20',
      warning: 'bg-yellow-400/20',
      info: 'bg-blue-400/20',
      error: 'bg-red-400/20',
    };
    return `
      <div class="${colors[type]} rounded-lg p-3">
        <p class="text-blue-100 text-sm">${label}</p>
        <p class="text-white text-lg font-bold">${value}</p>
      </div>
    `;
  }

  private renderSummaryCard(label: string, value: string, emoji: string): string {
    return `
      <div class="bg-white rounded-lg shadow-md p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-600 text-sm">${label}</p>
            <p class="text-2xl font-bold">${value}</p>
          </div>
          <span class="text-4xl">${emoji}</span>
        </div>
      </div>
    `;
  }

  private renderInfoRow(label: string, value: string, extraClass = ''): string {
    return `
      <div class="flex justify-between py-2 border-b border-gray-100">
        <span class="text-gray-600">${label}:</span>
        <span class="font-medium ${extraClass}">${value}</span>
      </div>
    `;
  }

  private renderFeatureItem(label: string, enabled: boolean): string {
    return `
      <div class="flex items-center justify-between py-2">
        <span>${label}</span>
        <span class="${enabled ? 'text-green-600' : 'text-red-600'}">${enabled ? '✅ Enabled' : '❌ Disabled'}</span>
      </div>
    `;
  }

  private renderIssueBreakdownTable(escapeJson: EscapeJson): string {
    const breakdown = escapeJson.analysis.issueBreakdown;
    const total = escapeJson.analysis.totalIssues;
    
    return `
    <div class="overflow-x-auto">
      <table class="min-w-full">
        <thead class="bg-gray-100">
          <tr>
            <th class="px-4 py-2 text-left">Issue Type</th>
            <th class="px-4 py-2 text-right">Count</th>
            <th class="px-4 py-2 text-right">Percentage</th>
          </tr>
        </thead>
        <tbody>
          ${breakdown.ghostImports > 0 ? this.renderBreakdownRow('Ghost Imports', breakdown.ghostImports, total) : ''}
          ${breakdown.mockApis > 0 ? this.renderBreakdownRow('Mock APIs', breakdown.mockApis, total) : ''}
          ${breakdown.sandboxApis > 0 ? this.renderBreakdownRow('Sandbox APIs', breakdown.sandboxApis, total) : ''}
          ${breakdown.securityRisks > 0 ? this.renderBreakdownRow('Security Risks', breakdown.securityRisks, total) : ''}
        </tbody>
      </table>
    </div>
    `;
  }

  private renderBreakdownRow(label: string, count: number, total: number): string {
    const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
    return `
      <tr class="border-t">
        <td class="px-4 py-2">${label}</td>
        <td class="px-4 py-2 text-right">${count}</td>
        <td class="px-4 py-2 text-right">${percentage}%</td>
      </tr>
    `;
  }

  private getChartScripts(): string {
    return `
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    `;
  }

  private renderIssueBreakdownChart(escapeJson: EscapeJson): string {
    const breakdown = escapeJson.analysis.issueBreakdown;
    const labels: string[] = [];
    const data: number[] = [];
    
    if (breakdown.ghostImports > 0) { labels.push('Ghost Imports'); data.push(breakdown.ghostImports); }
    if (breakdown.mockApis > 0) { labels.push('Mock APIs'); data.push(breakdown.mockApis); }
    if (breakdown.sandboxApis > 0) { labels.push('Sandbox APIs'); data.push(breakdown.sandboxApis); }
    if (breakdown.securityRisks > 0) { labels.push('Security Risks'); data.push(breakdown.securityRisks); }
    
    if (data.length === 0) {
      return this.renderIssueBreakdownTable(escapeJson);
    }

    return `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <div>
        <h3 class="text-lg font-semibold mb-3">Issue Breakdown</h3>
        <canvas id="issueChart"></canvas>
      </div>
    </div>
    <script>
      const ctx = document.getElementById('issueChart').getContext('2d');
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ${JSON.stringify(labels)},
          datasets: [{
            data: ${JSON.stringify(data)},
            backgroundColor: [
              '#3b82f6',
              '#10b981',
              '#f59e0b',
              '#ef4444',
              '#8b5cf6',
            ],
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom',
            }
          }
        }
      });
    </script>
    `;
  }
}
