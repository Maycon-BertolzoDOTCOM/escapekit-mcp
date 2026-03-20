import { describe, it, expect, beforeEach } from 'vitest';
import { PlaywrightAdapter } from '../../src/adapters/playwright-adapter';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

describe('PlaywrightAdapter', () => {
  let adapter: PlaywrightAdapter;
  const testFilePath = join(process.cwd(), 'test-playwright-output.json');

  beforeEach(() => {
    adapter = new PlaywrightAdapter();
    if (existsSync(testFilePath)) unlinkSync(testFilePath);
  });

  describe('canHandle', () => {
    it('should identify Playwright JSON with suites', () => {
      const json = JSON.stringify({ suites: [] });
      expect(adapter.canHandle(json)).toBe(true);
    });

    it('should identify Playwright JSON with config', () => {
      const json = JSON.stringify({ config: {} });
      expect(adapter.canHandle(json)).toBe(true);
    });

    it('should reject non-Playwright JSON', () => {
      const json = JSON.stringify({ random: 'data' });
      expect(adapter.canHandle(json)).toBe(false);
    });
  });

  describe('getFrameworkName', () => {
    it('should return playwright', () => {
      expect(adapter.getFrameworkName()).toBe('playwright');
    });
  });

  describe('load', () => {
    it('should parse Playwright JSON with passed tests', async () => {
      const data = {
        suites: [
          {
            title: 'Suite',
            tests: [
              { title: 'test one', ok: true },
              { title: 'test two', ok: true },
            ],
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(data));
      expect(results).toHaveLength(2);
      expect(results.every(r => r.outcome === 'passed')).toBe(true);
    });

    it('should parse Playwright JSON with failed tests', async () => {
      const data = {
        suites: [
          {
            title: 'Suite',
            tests: [
              {
                title: 'failing test',
                ok: false,
                error: { message: 'Timeout exceeded', stack: 'at test.ts:10' },
              },
            ],
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(data));
      expect(results).toHaveLength(1);
      expect(results[0].outcome).toBe('failed');
      expect(results[0].error).toContain('Timeout exceeded');
      expect(results[0].error).toContain('at test.ts:10');
    });

    it('should handle nested suites', async () => {
      const data = {
        suites: [
          {
            title: 'Parent',
            tests: [{ title: 'parent test', ok: true }],
            suites: [
              {
                title: 'Child',
                tests: [{ title: 'child test', ok: false, error: { message: 'fail' } }],
              },
            ],
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(data));
      expect(results).toHaveLength(2);
      expect(results[0].metadata?.suite).toContain('Parent');
      expect(results[1].metadata?.suite).toContain('Child');
    });

    it('should include duration from results', async () => {
      const data = {
        suites: [
          {
            title: 'Suite',
            tests: [
              {
                title: 'timed test',
                ok: true,
                results: [{ duration: 1500 }],
              },
            ],
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(data));
      expect(results[0].duration).toBe(1500);
    });

    it('should normalize test case names', async () => {
      const data = {
        suites: [
          {
            title: 'Auth Suite',
            tests: [{ title: 'should login (with) [email]', ok: true }],
          },
        ],
      };

      const results = await adapter.load(JSON.stringify(data));
      expect(results[0].testCase).toMatch(/^auth-suite-should-login-with-email$/);
    });

    it('should handle empty suites', async () => {
      const data = { suites: [] };
      const results = await adapter.load(JSON.stringify(data));
      expect(results).toHaveLength(0);
    });

    it('should load from file', async () => {
      const data = {
        suites: [
          {
            title: 'Suite',
            tests: [{ title: 'test', ok: true }],
          },
        ],
      };

      writeFileSync(testFilePath, JSON.stringify(data));
      const results = await adapter.load(testFilePath);
      expect(results).toHaveLength(1);
    });
  });
});
