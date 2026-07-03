/**
 * CodeMemória Governance — ComposioAdapter
 *
 * Executa ações corretivas automáticas via Composio:
 * - Pull Requests para ghost dependencies e security fixes
 * - Issues para compliance violations (LGPD, GDPR, OWASP)
 * - Notificações (Slack/webhook) para monitoramento
 *
 * Usa circuit breakers e rate limiters existentes para resiliência.
 *
 * @module governance/adapters/ComposioAdapter
 */

import type { ICorrectiveAction, CorrectiveActionResult, CorrectiveActionConfig } from '../interfaces.js';
import type { GovernancePassport } from '../types.js';
import type { Issue } from '../../validate/types.js';
import { RetryHandler, CircuitBreaker, createCircuitBreaker } from '../../lib/retry.js';
import { logger } from '../../logger.js';

/** Configuração do ComposioAdapter */
export interface ComposioAdapterOptions {
  /** API key do Composio */
  apiKey?: string;
  /** URL base da API Composio */
  baseUrl?: string;
  /** Timeout para chamadas de API (ms) */
  timeout?: number;
  /** Habilitar criação de PRs */
  enablePRs?: boolean;
  /** Habilitar criação de Issues */
  enableIssues?: boolean;
  /** Habilitar notificações */
  enableNotifications?: boolean;
  /** URL do webhook para notificações */
  webhookUrl?: string;
  /** Repositório alvo (owner/repo) */
  targetRepo?: string;
}

/** Payload para criação de PR via Composio */
interface PRPayload {
  title: string;
  body: string;
  head: string;
  base: string;
  files: Array<{ path: string; content: string }>;
}

/** Payload para criação de Issue via Composio */
interface IssuePayload {
  title: string;
  body: string;
  labels: string[];
  assignees?: string[];
}

/** Payload para notificação via webhook */
interface NotificationPayload {
  text: string;
  channel?: string;
  blocks?: unknown[];
}

export class ComposioAdapter implements ICorrectiveAction {
  private readonly log = logger.child('ComposioAdapter');
  private readonly retryHandler: RetryHandler;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly options: Required<ComposioAdapterOptions>;

  constructor(options: ComposioAdapterOptions = {}) {
    this.options = {
      apiKey: options.apiKey ?? process.env['COMPOSIO_API_KEY'] ?? '',
      baseUrl: options.baseUrl ?? 'https://api.composio.dev',
      timeout: options.timeout ?? 30000,
      enablePRs: options.enablePRs ?? true,
      enableIssues: options.enableIssues ?? true,
      enableNotifications: options.enableNotifications ?? true,
      webhookUrl: options.webhookUrl ?? process.env['SLACK_WEBHOOK_URL'] ?? '',
      targetRepo: options.targetRepo ?? '',
    };

    this.retryHandler = new RetryHandler({
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      jitterFactor: 0.25,
    });

    this.circuitBreaker = createCircuitBreaker({
      failureThreshold: 5,
      successThreshold: 2,
      timeoutMs: 60000,
    });
  }

  async execute(
    passport: GovernancePassport,
    issues: Issue[],
    config: CorrectiveActionConfig[],
  ): Promise<CorrectiveActionResult[]> {
    const results: CorrectiveActionResult[] = [];
    const timestamp = new Date();

    // Filtra configurações pelo riskLevel do passport
    const applicableConfigs = config.filter(c => c.enabled && c.riskLevel === passport.riskLevel);

    if (applicableConfigs.length === 0) {
      this.log.debug('No applicable corrective actions', { riskLevel: passport.riskLevel });
      return results;
    }

    for (const actionConfig of applicableConfigs) {
      try {
        let result: CorrectiveActionResult;

        switch (actionConfig.actionType) {
          case 'pull_request':
            result = await this.createPR(passport, issues, timestamp);
            break;
          case 'issue':
            result = await this.createIssue(passport, issues, timestamp);
            break;
          case 'notification':
            result = await this.sendNotification(passport, issues, timestamp, actionConfig.destination);
            break;
          default:
            result = {
              actionType: actionConfig.actionType,
              success: false,
              error: `Unknown action type: ${actionConfig.actionType}`,
              timestamp,
            };
        }

        results.push(result);
      } catch (error) {
        results.push({
          actionType: actionConfig.actionType,
          success: false,
          error: (error as Error).message,
          timestamp,
        });
      }
    }

    return results;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.circuitBreaker.execute(async () => {
        const response = await fetch(`${this.options.baseUrl}/health`, {
          method: 'GET',
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(5000),
        });
        return response.ok;
      });
      return result;
    } catch {
      return false;
    }
  }

  private async createPR(
    passport: GovernancePassport,
    issues: Issue[],
    timestamp: Date,
  ): Promise<CorrectiveActionResult> {
    if (!this.options.enablePRs) {
      return { actionType: 'pull_request', success: false, error: 'PRs disabled', timestamp };
    }

    if (!this.options.targetRepo) {
      return { actionType: 'pull_request', success: false, error: 'No target repo configured', timestamp };
    }

    const prPayload = this.buildPRPayload(passport, issues);

    try {
      const result = await this.retryHandler.execute(async () => {
        return this.circuitBreaker.execute(async () => {
          const response = await fetch(`${this.options.baseUrl}/v1/github/pr`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
              repo: this.options.targetRepo,
              ...prPayload,
            }),
            signal: AbortSignal.timeout(this.options.timeout),
          });

          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Composio API error: ${response.status} - ${errorBody}`);
          }

          return response.json() as Promise<{ url: string; number: number }>;
        });
      });

      this.log.info('PR created', { url: result.url, passportId: passport.passportId });

      return {
        actionType: 'pull_request',
        success: true,
        resourceUrl: result.url,
        timestamp,
      };
    } catch (error) {
      this.log.error('Failed to create PR', { error: (error as Error).message });
      return {
        actionType: 'pull_request',
        success: false,
        error: (error as Error).message,
        timestamp,
      };
    }
  }

  private async createIssue(
    passport: GovernancePassport,
    issues: Issue[],
    timestamp: Date,
  ): Promise<CorrectiveActionResult> {
    if (!this.options.enableIssues) {
      return { actionType: 'issue', success: false, error: 'Issues disabled', timestamp };
    }

    if (!this.options.targetRepo) {
      return { actionType: 'issue', success: false, error: 'No target repo configured', timestamp };
    }

    const issuePayload = this.buildIssuePayload(passport, issues);

    try {
      const result = await this.retryHandler.execute(async () => {
        return this.circuitBreaker.execute(async () => {
          const response = await fetch(`${this.options.baseUrl}/v1/github/issue`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
              repo: this.options.targetRepo,
              ...issuePayload,
            }),
            signal: AbortSignal.timeout(this.options.timeout),
          });

          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Composio API error: ${response.status} - ${errorBody}`);
          }

          return response.json() as Promise<{ url: string; number: number }>;
        });
      });

      this.log.info('Issue created', { url: result.url, passportId: passport.passportId });

      return {
        actionType: 'issue',
        success: true,
        resourceUrl: result.url,
        timestamp,
      };
    } catch (error) {
      this.log.error('Failed to create issue', { error: (error as Error).message });
      return {
        actionType: 'issue',
        success: false,
        error: (error as Error).message,
        timestamp,
      };
    }
  }

  private async sendNotification(
    passport: GovernancePassport,
    issues: Issue[],
    timestamp: Date,
    destination?: string,
  ): Promise<CorrectiveActionResult> {
    if (!this.options.enableNotifications) {
      return { actionType: 'notification', success: false, error: 'Notifications disabled', timestamp };
    }

    const webhookUrl = destination ?? this.options.webhookUrl;
    if (!webhookUrl) {
      return { actionType: 'notification', success: false, error: 'No webhook URL configured', timestamp };
    }

    const payload = this.buildNotificationPayload(passport, issues);

    try {
      await this.retryHandler.execute(async () => {
        return this.circuitBreaker.execute(async () => {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.options.timeout),
          });

          if (!response.ok) {
            throw new Error(`Webhook error: ${response.status}`);
          }
        });
      });

      this.log.info('Notification sent', { passportId: passport.passportId });

      return {
        actionType: 'notification',
        success: true,
        timestamp,
      };
    } catch (error) {
      this.log.error('Failed to send notification', { error: (error as Error).message });
      return {
        actionType: 'notification',
        success: false,
        error: (error as Error).message,
        timestamp,
      };
    }
  }

  private buildPRPayload(passport: GovernancePassport, issues: Issue[]): PRPayload {
    const ghostDeps = issues.filter(i => i.type === 'GHOST_IMPORT');
    const securityIssues = issues.filter(i => i.type === 'SECURITY_VULNERABILITY');

    const title = `fix: CodeMemória auto-fix for ${passport.riskLevel} risk issues`;
    const body = [
      `## Automated Fix by CodeMemória`,
      '',
      `**Passport ID:** ${passport.passportId}`,
      `**Risk Level:** ${passport.riskLevel}`,
      `**Fingerprint:** ${passport.codeFingerprint.hash.slice(0, 16)}...`,
      '',
      '### Issues Fixed',
      '',
      ...issues.map(i => `- [${i.severity.toUpperCase()}] ${i.type}: ${i.message}`),
      '',
      '### Changes',
      '',
      ghostDeps.length > 0 ? `- Fixed ${ghostDeps.length} ghost dependency imports` : '',
      securityIssues.length > 0 ? `- Patched ${securityIssues.length} security vulnerabilities` : '',
      '',
      '---',
      '*Generated automatically by CodeMemória Governance Engine*',
    ].filter(Boolean).join('\n');

    const files = issues
      .filter(i => i.file)
      .map(i => ({
        path: i.file!,
        content: i.suggestion ?? `// TODO: Fix ${i.type} - ${i.message}`,
      }));

    return {
      title,
      body,
      head: `codememoria/fix-${passport.passportId.slice(0, 8)}`,
      base: 'main',
      files,
    };
  }

  private buildIssuePayload(passport: GovernancePassport, issues: Issue[]): IssuePayload {
    const complianceIssues = issues.filter(i =>
      i.type === 'SECURITY_VULNERABILITY' || i.type === 'SECURITY_WARNING'
    );

    const title = `[CodeMemória] ${passport.riskLevel.toUpperCase()}: Compliance violations detected`;
    const body = [
      `## Compliance Report`,
      '',
      `**Passport ID:** ${passport.passportId}`,
      `**Risk Level:** ${passport.riskLevel}`,
      `**Fingerprint:** ${passport.codeFingerprint.hash.slice(0, 16)}...`,
      '',
      '### Compliance Stamps',
      '',
      ...passport.complianceStamps.map(s =>
        `- **${s.regulationId}**: ${(s.score * 100).toFixed(0)}% (${s.clauses.length} clauses)`
      ),
      '',
      '### Issues Requiring Attention',
      '',
      ...complianceIssues.map(i => `- [${i.severity.toUpperCase()}] ${i.type}: ${i.message}`),
      '',
      '### Estimated Remediation Cost',
      '',
      `**${passport.estimatedRemediationCost} hours**`,
      '',
      '---',
      '*Generated automatically by CodeMemória Governance Engine*',
    ].join('\n');

    const labels = ['codememoria', `risk:${passport.riskLevel}`];
    if (complianceIssues.length > 0) labels.push('compliance');

    return { title, body, labels };
  }

  private buildNotificationPayload(passport: GovernancePassport, issues: Issue[]): NotificationPayload {
    const emoji = {
      low: '✅',
      medium: '⚠️',
      high: '🔶',
      critical: '🚨',
    }[passport.riskLevel] ?? '❓';

    const text = [
      `${emoji} *CodeMemória Alert: ${passport.riskLevel.toUpperCase()}*`,
      '',
      `Passport: ${passport.passportId.slice(0, 8)}...`,
      `Risk: ${passport.riskLevel}`,
      `Issues: ${issues.length}`,
      `Compliance: ${passport.complianceStamps.length} stamps`,
      '',
      issues.slice(0, 3).map(i => `• ${i.type}: ${i.message}`).join('\n'),
      issues.length > 3 ? `...and ${issues.length - 3} more` : '',
    ].filter(Boolean).join('\n');

    return { text };
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.options.apiKey}`,
      'X-CodeMemoria-Version': '1.0.0',
    };
  }
}

/**
 * Factory function para criar ComposioAdapter com configuração padrão
 */
export function createComposioAdapter(options?: ComposioAdapterOptions): ComposioAdapter {
  return new ComposioAdapter(options);
}
