import { describe, it, expect, beforeEach } from 'vitest';
import { CypressAdapter } from '../../src/adapters/cypress-adapter';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

describe('CypressAdapter', () => {
  let adapter: CypressAdapter;
  const testFilePath = join(process.cwd(), 'test-cypress-output.json');

  beforeEach(() => {
    adapter = new CypressAdapter();
    if (existsSync(testFilePath)) unlinkSync(testFilePath);
  });

  describe('canHandle', () => {
    it('should identify Cypress JSON with browserName', () => {
      const json = JSON.stringify({ browserName: 'chrome', results: [] });
      expect(adapter.canHandle(json)).toBe(true);
    });

    it('should identify Cypress JSON with results array', () => {
      const json = JSON.stringify({ results: [{ suite: { tests: [] } }] });
      expect(adapter.canHandle(json)).toBe(true);
    });

    it('should reject non-Cypress JSON', () => {
      const json = JSON.stringify({ random: 'data' });
      expect(adapter.canHandle(json)).toBe(false);
    });
  });

  describe('getFrameworkName', () => {
    it('should return cypress', () => {
      expect(adapter.getFrameworkName()).toBe('cypress');
    });
  });

  describe('load', () => {
    it('should parse Cypress JSON with passed tests', async () => {
      const data = {
        browserName: 'chrome',
        results: [
          {
            suite: {
              uuid: '123',
              title: 'Auth',
              tests: [
                { title: ['should login'], state: 'passed', timings: { duration: 500 } },
                { title: ['should logout'], state: 'passed', timings: { duration: 300 } },
              ],
            },
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(data));
      expect(results).toHaveLength(2);
      expect(results.every(r => r.outcome === 'passed')).toBe(true);
      expect(results[0].duration).toBe(500);
    });

    it('should parse Cypress JSON with failed tests', async () => {
      const data = {
        browserName: 'chrome',
        results: [
          {
            suite: {
              uuid: '123',
              title: 'Auth',
              tests: [
                {
                  title: ['should fail'],
                  state: 'failed',
                  error: { message: 'Assertion failed', stack: 'at cypress/e2e/auth.cy.ts:10' },
                  timings: { duration: 200 },
                },
              ],
            },
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(data));
      expect(results).toHaveLength(1);
      expect(results[0].outcome).toBe('failed');
      expect(results[0].error).toContain('Assertion failed');
    });

    it('should parse nested suites', async () => {
      const data = {
        results: [
          {
            suite: {
              uuid: '1',
              title: 'Parent',
              tests: [{ title: ['parent test'], state: 'passed' }],
              suites: [
                {
                  uuid: '2',
                  title: 'Child',
                  tests: [{ title: ['child test'], state: 'passed' }],
                },
              ],
            },
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(data));
      expect(results).toHaveLength(2);
      expect(results[1].metadata?.suite).toBe('Child');
    });

    it('should join title array for test case name', async () => {
      const data = {
        results: [
          {
            suite: {
              uuid: '1',
              title: 'Dashboard',
              tests: [{ title: ['should', 'display', 'stats'], state: 'passed' }],
            },
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(data));
      expect(results[0].testCase).toContain('should-display-stats');
    });

    it('should map pending state to skipped', async () => {
      const data = {
        results: [
          {
            suite: {
              uuid: '1',
              title: 'Suite',
              tests: [{ title: ['pending test'], state: 'pending' }],
            },
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(data));
      expect(results[0].outcome).toBe('skipped');
    });

    it('should handle empty results', async () => {
      const data = { results: [] };
      const results = await adapter.load(JSON.stringify(data));
      expect(results).toHaveLength(0);
    });

    it('should load from file', async () => {
      const data = {
        results: [
          {
            suite: {
              uuid: '1',
              title: 'Suite',
              tests: [{ title: ['test'], state: 'passed' }],
            },
          },
        ],
      };

      writeFileSync(testFilePath, JSON.stringify(data));
      const results = await adapter.load(testFilePath);
      expect(results).toHaveLength(1);
    });

    it('should get error from attempt if no direct error', async () => {
      const data = {
        results: [
          {
            suite: {
              uuid: '1',
              title: 'Suite',
              tests: [
                {
                  title: ['flaky test'],
                  state: 'failed',
                  attempts: [
                    { state: 'failed', error: { message: 'Retry failed' }, duration: 100 },
                  ],
                },
              ],
            },
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(data));
      expect(results[0].error).toContain('Retry failed');
      expect(results[0].duration).toBe(100);
    });
  });
});
