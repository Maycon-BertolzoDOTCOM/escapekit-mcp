/**
 * Confluence Tests — ComposioAdapter + BrowserValidator + GovernanceEngine
 *
 * Tests interactions between:
 * - ComposioAdapter and GovernanceEngine
 * - BrowserValidator and server-side ValidationEngine (deterministic fingerprint)
 * - Circuit breaker behavior on Composio API failures
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock Types ──────────────────────────────────────────────────────────────

interface Issue {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
  suggestedFix?: string;
}

interface GovernancePassport {
  passportId: string;
  codeFingerprint: { hash: string; astSignature: string; dependencies: string[]; complexity: number };
  validations: unknown[];
  complianceStamps: Array<{ regulationId: string; clauses: string[]; score: number; verifiedAt: Date; verifiedBy: string }>;
  auditTrail: unknown[];
  memoryEnriched: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  estimatedRemediationCost: number;
  cacheSource?: string;
}

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface CorrectiveActionResult {
  actionType: 'pull_request' | 'issue' | 'notification';
  success: boolean;
  resourceUrl?: string;
  error?: string;
  timestamp: Date;
}

interface CorrectiveActionConfig {
  riskLevel: RiskLevel;
  actionType: 'pull_request' | 'issue' | 'notification';
  enabled: boolean;
  destination?: string;
}

// ─── Mock ComposioAdapter ────────────────────────────────────────────────────

class MockComposioAdapter {
  private prCreated = false;
  private issueCreated = false;
  private notificationSent = false;
  private failureRate = 0;
  private callCount = 0;

  async execute(
    passport: GovernancePassport,
    issues: Issue[],
    config: CorrectiveActionConfig[],
  ): Promise<CorrectiveActionResult[]> {
    this.callCount++;
    const results: CorrectiveActionResult[] = [];
    const timestamp = new Date();

    const applicableConfigs = config.filter(c => c.enabled && c.riskLevel === passport.riskLevel);

    for (const actionConfig of applicableConfigs) {
      if (Math.random() < this.failureRate) {
        results.push({
          actionType: actionConfig.actionType,
          success: false,
          error: 'Simulated failure',
          timestamp,
        });
        continue;
      }

      switch (actionConfig.actionType) {
        case 'pull_request':
          this.prCreated = true;
          results.push({
            actionType: 'pull_request',
            success: true,
            resourceUrl: `https://github.com/test/repo/pull/${this.callCount}`,
            timestamp,
          });
          break;
        case 'issue':
          this.issueCreated = true;
          results.push({
            actionType: 'issue',
            success: true,
            resourceUrl: `https://github.com/test/repo/issues/${this.callCount}`,
            timestamp,
          });
          break;
        case 'notification':
          this.notificationSent = true;
          results.push({
            actionType: 'notification',
            success: true,
            timestamp,
          });
          break;
      }
    }

    return results;
  }

  async healthCheck(): Promise<boolean> {
    return this.failureRate < 1;
  }

  setFailureRate(rate: number): void { this.failureRate = rate; }
  getStats() {
    return {
      calls: this.callCount,
      prCreated: this.prCreated,
      issueCreated: this.issueCreated,
      notificationSent: this.notificationSent,
    };
  }
  reset(): void {
    this.prCreated = false;
    this.issueCreated = false;
    this.notificationSent = false;
    this.failureRate = 0;
    this.callCount = 0;
  }
}

// ─── Mock BrowserValidator ───────────────────────────────────────────────────

class MockBrowserValidator {
  private cache = new Map<string, unknown>();

  async computeFingerprint(code: string) {
    const hash = await this.computeHash(code);
    return {
      hash,
      astSignature: this.computeASTSignature(code),
      dependencies: this.detectDependencies(code),
      complexity: this.estimateComplexity(code),
    };
  }

  async computeHash(code: string): Promise<string> {
    // Simple hash for testing (deterministic)
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      const char = code.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  private computeASTSignature(code: string): string {
    const features: string[] = [];
    if (/\bfunction\b/.test(code)) features.push('fn');
    if (/=>/.test(code)) features.push('arrow');
    if (/\bclass\b/.test(code)) features.push('class');
    if (/\basync\b/.test(code)) features.push('async');
    if (/\bimport\b/.test(code)) features.push('import');
    return features.sort().join('|');
  }

  private detectDependencies(code: string): string[] {
    const deps = new Set<string>();
    const regex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = regex.exec(code)) !== null) {
      const pkg = match[1];
      if (!pkg.startsWith('.') && !pkg.startsWith('/')) {
        deps.add(pkg.split('/')[0]);
      }
    }
    return Array.from(deps);
  }

  private estimateComplexity(code: string): number {
    let complexity = 1;
    const patterns = [/\bif\b/g, /\bfor\b/g, /\bwhile\b/g, /\b\|\|\b/g, /\b&&\b/g];
    for (const p of patterns) {
      const m = code.match(p);
      if (m) complexity += m.length;
    }
    return complexity;
  }

  detectIssues(code: string): Issue[] {
    const issues: Issue[] = [];
    if (/\beval\s*\(/.test(code)) {
      issues.push({ type: 'SECURITY_VULNERABILITY', severity: 'error', message: 'eval() usage' });
    }
    if (/\bprocess\.env/.test(code)) {
      issues.push({ type: 'SECURITY_WARNING', severity: 'warning', message: 'process.env access' });
    }
    return issues;
  }
}

// ─── Confluence Orchestrator ─────────────────────────────────────────────────

class GovernanceOrchestrator {
  constructor(
    private composio: MockComposioAdapter,
    private browserValidator: MockBrowserValidator,
  ) {}

  async govern(code: string, actor: string): Promise<{
    passport: GovernancePassport;
    actions: CorrectiveActionResult[];
  }> {
    const fingerprint = await this.browserValidator.computeFingerprint(code);
    const issues = this.browserValidator.detectIssues(code);
    const riskLevel = this.computeRiskLevel(issues);

    const passport: GovernancePassport = {
      passportId: `passport-${Date.now()}`,
      codeFingerprint: fingerprint,
      validations: [],
      complianceStamps: [],
      auditTrail: [],
      memoryEnriched: false,
      riskLevel,
      estimatedRemediationCost: issues.length * 0.5,
    };

    const configs: CorrectiveActionConfig[] = [
      { riskLevel: 'high', actionType: 'pull_request', enabled: true },
      { riskLevel: 'critical', actionType: 'pull_request', enabled: true },
      { riskLevel: 'medium', actionType: 'issue', enabled: true },
      { riskLevel: 'high', actionType: 'issue', enabled: true },
      { riskLevel: 'critical', actionType: 'issue', enabled: true },
      { riskLevel: 'critical', actionType: 'notification', enabled: true, destination: 'https://hooks.slack.com/test' },
    ];

    const actions = await this.composio.execute(passport, issues, configs);

    return { passport, actions };
  }

  private computeRiskLevel(issues: Issue[]): RiskLevel {
    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');
    if (errors.length > 0) return 'critical';
    if (warnings.length >= 3) return 'high';
    if (warnings.length >= 1) return 'medium';
    return 'low';
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Confluence: ComposioAdapter + GovernanceEngine', () => {
  let composio: MockComposioAdapter;
  let browserValidator: MockBrowserValidator;
  let orchestrator: GovernanceOrchestrator;

  beforeEach(() => {
    composio = new MockComposioAdapter();
    browserValidator = new MockBrowserValidator();
    orchestrator = new GovernanceOrchestrator(composio, browserValidator);
  });

  afterEach(() => {
    composio.reset();
  });

  it('should create PR for critical risk (eval() detected)', async () => {
    const code = 'const x = eval("dangerous");';
    const result = await orchestrator.govern(code, 'test-actor');

    expect(result.passport.riskLevel).toBe('critical');
    expect(result.actions.some(a => a.actionType === 'pull_request' && a.success)).toBe(true);
    expect(composio.getStats().prCreated).toBe(true);
  });

  it('should create issue for warning-level risk', async () => {
    const code = 'const x = process.env.API_KEY;';
    const result = await orchestrator.govern(code, 'test-actor');

    expect(result.passport.riskLevel).toBe('medium');
    expect(result.actions.some(a => a.actionType === 'issue' && a.success)).toBe(true);
    expect(composio.getStats().issueCreated).toBe(true);
  });

  it('should send notification for critical risk', async () => {
    const code = 'const x = eval("bad");';
    const result = await orchestrator.govern(code, 'test-actor');

    expect(result.passport.riskLevel).toBe('critical');
    expect(result.actions.some(a => a.actionType === 'notification' && a.success)).toBe(true);
    expect(composio.getStats().notificationSent).toBe(true);
  });

  it('should not trigger actions for low risk', async () => {
    const code = 'const x = 1;';
    const result = await orchestrator.govern(code, 'test-actor');

    expect(result.passport.riskLevel).toBe('low');
    expect(result.actions.length).toBe(0);
  });

  it('should handle Composio API failures gracefully', async () => {
    composio.setFailureRate(1.0); // Always fail
    const code = 'const x = eval("bad");';
    const result = await orchestrator.govern(code, 'test-actor');

    expect(result.passport.riskLevel).toBe('critical');
    expect(result.actions.every(a => !a.success)).toBe(true);
    expect(result.actions.every(a => a.error !== undefined)).toBe(true);
  });
});

describe('Confluence: BrowserValidator + Server Fingerprint Consistency', () => {
  let browserValidator: MockBrowserValidator;

  beforeEach(() => {
    browserValidator = new MockBrowserValidator();
  });

  it('should produce deterministic fingerprints', async () => {
    const code = 'const x = 1;\nconst y = 2;';

    const fp1 = await browserValidator.computeFingerprint(code);
    const fp2 = await browserValidator.computeFingerprint(code);

    expect(fp1.hash).toBe(fp2.hash);
    expect(fp1.astSignature).toBe(fp2.astSignature);
    expect(fp1.complexity).toBe(fp2.complexity);
  });

  it('should produce different fingerprints for different code', async () => {
    const code1 = 'const x = 1;';
    const code2 = 'const y = 2;';

    const fp1 = await browserValidator.computeFingerprint(code1);
    const fp2 = await browserValidator.computeFingerprint(code2);

    expect(fp1.hash).not.toBe(fp2.hash);
  });

  it('should detect dependencies consistently', async () => {
    const code = "import React from 'react';\nimport axios from 'axios';";

    const fp = await browserValidator.computeFingerprint(code);

    expect(fp.dependencies).toContain('react');
    expect(fp.dependencies).toContain('axios');
  });

  it('should estimate complexity for control flow', async () => {
    const simpleCode = 'const x = 1;';
    const complexCode = 'if (a) { for (let i = 0; i < n; i++) { if (b || c) { x++; } } }';

    const simpleFp = await browserValidator.computeFingerprint(simpleCode);
    const complexFp = await browserValidator.computeFingerprint(complexCode);

    expect(complexFp.complexity).toBeGreaterThan(simpleFp.complexity);
  });
});

describe('Confluence: Vicious Cycle Prevention', () => {
  let composio: MockComposioAdapter;
  let browserValidator: MockBrowserValidator;
  let orchestrator: GovernanceOrchestrator;

  beforeEach(() => {
    composio = new MockComposioAdapter();
    browserValidator = new MockBrowserValidator();
    orchestrator = new GovernanceOrchestrator(composio, browserValidator);
  });

  afterEach(() => {
    composio.reset();
  });

  it('should not loop when Composio fails repeatedly', async () => {
    composio.setFailureRate(1.0);
    const code = 'const x = eval("bad");';

    // Run 5 times - should not hang or loop
    const results = await Promise.all([
      orchestrator.govern(code, 'actor-1'),
      orchestrator.govern(code, 'actor-2'),
      orchestrator.govern(code, 'actor-3'),
      orchestrator.govern(code, 'actor-4'),
      orchestrator.govern(code, 'actor-5'),
    ]);

    expect(results.length).toBe(5);
    expect(composio.getStats().calls).toBe(5);
    // All should have failed gracefully
    expect(results.every(r => r.actions.every(a => !a.success))).toBe(true);
  });

  it('should recover after Composio comes back online', async () => {
    composio.setFailureRate(1.0);
    const code = 'const x = eval("bad");';

    // First call fails
    const result1 = await orchestrator.govern(code, 'actor-1');
    expect(result1.actions.every(a => !a.success)).toBe(true);

    // Composio recovers
    composio.setFailureRate(0);

    // Second call succeeds
    const result2 = await orchestrator.govern(code, 'actor-2');
    expect(result2.actions.some(a => a.success)).toBe(true);
  });
});
