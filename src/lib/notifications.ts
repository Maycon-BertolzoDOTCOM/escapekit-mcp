/**
 * Notification Module
 * Supports Slack webhooks and Jira comment creation
 */

import axios from 'axios';

// ─── Types ──────────────────────────────────────────────

export interface NotificationConfig {
  slack?: SlackConfig;
  jira?: JiraConfig;
}

export interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
}

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
}

export interface UploadSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  uploaded: number;
  errors: number;
  passRate: string;
  duration: number;
  framework: string;
  testRunId?: number;
  testRunUrl?: string;
  file: string;
}

// ─── Slack ──────────────────────────────────────────────

type SlackText = {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
};

type SlackAccessory = {
  type: 'button';
  text: SlackText;
  url: string;
  style?: 'primary' | 'danger';
};



type SlackBlock = {
  type: 'header';
  text: SlackText;
} | {
  type: 'section';
  text?: SlackText;
  fields?: SlackText[];
} | {
  type: 'actions';
  elements: SlackAccessory[];
};

export class SlackNotifier {
  constructor(private config: SlackConfig) {}

  async sendSummary(summary: UploadSummary): Promise<boolean> {
    const status = summary.errors > 0 ? '⚠️' : summary.failed > 0 ? '🔴' : '🟢';
    const passEmoji = summary.passed > 0 ? '✅' : '';
    const failEmoji = summary.failed > 0 ? '❌' : '';
    const errEmoji = summary.errors > 0 ? '⚠️' : '';

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${status} EscapeKit Test Results`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Framework:*\n${summary.framework}` },
          { type: 'mrkdwn', text: `*Pass Rate:*\n${summary.passRate}` },
          { type: 'mrkdwn', text: `${passEmoji} *Passed:*\n${summary.passed}` },
          { type: 'mrkdwn', text: `${failEmoji} *Failed:*\n${summary.failed}` },
          { type: 'mrkdwn', text: `*Skipped:*\n${summary.skipped}` },
          { type: 'mrkdwn', text: `${errEmoji} *Errors:*\n${summary.errors}` },
          { type: 'mrkdwn', text: `*Duration:*\n${(summary.duration / 1000).toFixed(1)}s` },
          { type: 'mrkdwn', text: `*Uploaded:*\n${summary.uploaded}/${summary.total}` },
        ],
      },
    ];

    if (summary.testRunUrl) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View TestRun' },
            url: summary.testRunUrl,
            style: summary.failed > 0 ? 'danger' : 'primary',
          },
        ],
      });
    }

    try {
      await axios.post(this.config.webhookUrl, {
        channel: this.config.channel,
        username: this.config.username || 'EscapeKit',
        blocks,
      });
      return true;
    } catch (error: unknown) {
      console.error('Slack notification failed:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async sendFailureAlert(
    failures: Array<{ name: string; error: string }>,
    testRunUrl?: string
  ): Promise<boolean> {
    const failureText = failures
      .slice(0, 10)
      .map(f => `• \`${f.name}\`: ${f.error.substring(0, 100)}`)
      .join('\n');

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🔴 Test Failures Detected' },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*${failures.length} test(s) failed:*\n${failureText}` },
      },
    ];

    if (testRunUrl) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Failures' },
            url: testRunUrl,
            style: 'danger',
          },
        ],
      });
    }

    try {
      await axios.post(this.config.webhookUrl, {
        channel: this.config.channel,
        username: this.config.username || 'EscapeKit',
        blocks,
      });
      return true;
    } catch (error: unknown) {
      console.error('Slack failure alert failed:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }
}

// ─── Jira ───────────────────────────────────────────────

export class JiraNotifier {
  private auth: string;

  constructor(private config: JiraConfig) {
    this.auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  }

  private async request<T>(method: 'GET' | 'POST' | 'PUT', path: string, data?: unknown): Promise<T> {
    const response = await axios.request({
      method,
      url: `${this.config.baseUrl}/rest/api/3${path}`,
      headers: {
        Authorization: `Basic ${this.auth}`,
        'Content-Type': 'application/json',
      },
      data,
    });
    return response.data;
  }

  async addComment(issueKey: string, summary: UploadSummary): Promise<boolean> {
    const statusIcon = summary.errors > 0 ? '⚠️' : summary.failed > 0 ? '🔴' : '🟢';

    const body = {
      body: {
        version: 1,
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: `${statusIcon} EscapeKit Test Results (${summary.framework})`,
                marks: [{ type: 'strong' }],
              },
            ],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: `Pass Rate: ${summary.passRate}` }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'text',
                        text: `Passed: ${summary.passed} / Failed: ${summary.failed} / Skipped: ${summary.skipped}`,
                      },
                    ],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'text',
                        text: `Uploaded: ${summary.uploaded}/${summary.total} (errors: ${summary.errors})`,
                      },
                    ],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', text: `Duration: ${(summary.duration / 1000).toFixed(1)}s` },
                    ],
                  },
                ],
              },
            ],
          },
          ...(summary.testRunUrl
            ? [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'View TestRun: ' },
                    {
                      type: 'text',
                      text: summary.testRunUrl,
                      marks: [{ type: 'link', attrs: { href: summary.testRunUrl } }],
                    },
                  ],
                },
              ]
            : []),
        ],
      },
    };

    try {
      await this.request('POST', `/issue/${issueKey}/comment`, body);
      return true;
    } catch (error: unknown) {
      console.error('Jira comment failed:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async findIssuesByLabel(label: string): Promise<string[]> {
    try {
      const data = await this.request<{issues: Array<{key: string}>}>(
        'GET',
        `/search?jql=labels=${label}&fields=key&maxResults=10`
      );
      return data.issues?.map(i => i.key) || [];
    } catch {
      return [];
    }
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<boolean> {
    try {
      await this.request('POST', `/issue/${issueKey}/transitions`, {
        transition: { id: transitionId },
      });
      return true;
    } catch (error: unknown) {
      console.error('Jira transition failed:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }
}

// ─── Orchestrator ───────────────────────────────────────

export class NotificationManager {
  private slack?: SlackNotifier;
  private jira?: JiraNotifier;

  constructor(config: NotificationConfig) {
    if (config.slack?.webhookUrl) {
      this.slack = new SlackNotifier(config.slack);
    }
    if (config.jira?.baseUrl && config.jira?.apiToken) {
      this.jira = new JiraNotifier(config.jira);
    }
  }

  hasSlack(): boolean {
    return !!this.slack;
  }

  hasJira(): boolean {
    return !!this.jira;
  }

  async notifyAll(summary: UploadSummary, jiraIssueKey?: string): Promise<void> {
    const promises: Promise<unknown>[] = [];

    if (this.slack) {
      promises.push(this.slack.sendSummary(summary));
    }

    if (this.jira && jiraIssueKey) {
      promises.push(this.jira.addComment(jiraIssueKey, summary));
    }

    await Promise.allSettled(promises);
  }

  async notifyFailures(
    failures: Array<{ name: string; error: string }>,
    testRunUrl?: string
  ): Promise<void> {
    if (this.slack && failures.length > 0) {
      await this.slack.sendFailureAlert(failures, testRunUrl);
    }
  }
}

// ─── Config Loader ──────────────────────────────────────

export function loadNotificationConfig(): NotificationConfig {
  const config: NotificationConfig = {};

  if (process.env.SLACK_WEBHOOK_URL) {
    config.slack = {
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channel: process.env.SLACK_CHANNEL,
      username: process.env.SLACK_USERNAME || 'EscapeKit',
    };
  }

  if (process.env.JIRA_BASE_URL && process.env.JIRA_API_TOKEN) {
    config.jira = {
      baseUrl: process.env.JIRA_BASE_URL,
      email: process.env.JIRA_EMAIL || '',
      apiToken: process.env.JIRA_API_TOKEN,
      projectKey: process.env.JIRA_PROJECT_KEY || '',
    };
  }

  return config;
}
