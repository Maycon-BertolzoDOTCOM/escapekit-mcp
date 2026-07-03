import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import {
  SlackNotifier,
  JiraNotifier,
  NotificationManager,
  loadNotificationConfig,
} from '../../src/lib/notifications';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

const mockSummary = {
  total: 100,
  passed: 80,
  failed: 10,
  skipped: 10,
  uploaded: 90,
  errors: 0,
  passRate: '80.0',
  duration: 5000,
  framework: 'vitest',
  testRunId: 42,
  testRunUrl: 'https://kiwi.example.com/runs/42',
  file: 'results.json',
};

describe('SlackNotifier', () => {
  it('should send summary to Slack', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: 'ok' });

    const notifier = new SlackNotifier({ webhookUrl: 'https://hooks.slack.com/test' });
    const result = await notifier.sendSummary(mockSummary);

    expect(result).toBe(true);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({
        username: 'EscapeKit',
        blocks: expect.any(Array),
      })
    );
  });

  it('should send failure alert', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: 'ok' });

    const notifier = new SlackNotifier({ webhookUrl: 'https://hooks.slack.com/test' });
    const result = await notifier.sendFailureAlert(
      [{ name: 'test-login', error: 'Timeout' }],
      'https://kiwi.example.com/runs/42'
    );

    expect(result).toBe(true);
  });

  it('should return false on Slack error', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('Webhook failed'));

    const notifier = new SlackNotifier({ webhookUrl: 'https://hooks.slack.com/test' });
    const result = await notifier.sendSummary(mockSummary);

    expect(result).toBe(false);
  });
});

describe('JiraNotifier', () => {
  it('should add comment to Jira issue', async () => {
    mockedAxios.request.mockResolvedValueOnce({ data: { id: '123' } });

    const notifier = new JiraNotifier({
      baseUrl: 'https://jira.example.com',
      email: 'user@test.com',
      apiToken: 'token123',
      projectKey: 'ESC',
    });

    const result = await notifier.addComment('ESC-42', mockSummary);

    expect(result).toBe(true);
    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: 'https://jira.example.com/rest/api/3/issue/ESC-42/comment',
      })
    );
  });

  it('should return false on Jira error', async () => {
    mockedAxios.request.mockRejectedValueOnce(new Error('Auth failed'));

    const notifier = new JiraNotifier({
      baseUrl: 'https://jira.example.com',
      email: 'user@test.com',
      apiToken: 'bad-token',
      projectKey: 'ESC',
    });

    const result = await notifier.addComment('ESC-42', mockSummary);
    expect(result).toBe(false);
  });
});

describe('NotificationManager', () => {
  it('should detect Slack configured', () => {
    const manager = new NotificationManager({
      slack: { webhookUrl: 'https://hooks.slack.com/test' },
    });
    expect(manager.hasSlack()).toBe(true);
    expect(manager.hasJira()).toBe(false);
  });

  it('should detect Jira configured', () => {
    const manager = new NotificationManager({
      jira: {
        baseUrl: 'https://jira.test.com',
        email: 'a@b.com',
        apiToken: 'x',
        projectKey: 'ESC',
      },
    });
    expect(manager.hasJira()).toBe(true);
    expect(manager.hasSlack()).toBe(false);
  });

  it('should notify all channels', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: 'ok' });
    mockedAxios.request.mockResolvedValueOnce({ data: { id: '123' } });

    const manager = new NotificationManager({
      slack: { webhookUrl: 'https://hooks.slack.com/test' },
      jira: {
        baseUrl: 'https://jira.test.com',
        email: 'a@b.com',
        apiToken: 'x',
        projectKey: 'ESC',
      },
    });

    await manager.notifyAll(mockSummary, 'ESC-42');
  });
});

describe('loadNotificationConfig', () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
  });

  it('should load Slack config from env', () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    process.env.SLACK_CHANNEL = '#ci';

    const config = loadNotificationConfig();
    expect(config.slack?.webhookUrl).toBe('https://hooks.slack.com/test');
    expect(config.slack?.channel).toBe('#ci');
  });

  it('should load Jira config from env', () => {
    process.env.JIRA_BASE_URL = 'https://jira.test.com';
    process.env.JIRA_API_TOKEN = 'token';
    process.env.JIRA_EMAIL = 'user@test.com';

    const config = loadNotificationConfig();
    expect(config.jira?.baseUrl).toBe('https://jira.test.com');
  });

  it('should return empty config when no env vars set', () => {
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.JIRA_BASE_URL;

    const config = loadNotificationConfig();
    expect(config.slack).toBeUndefined();
    expect(config.jira).toBeUndefined();
  });
});
