/**
 * LocalEnvironment - Runs tests in local Node.js environment
 *
 * Spawns the dev server locally, runs health checks against it,
 * then cleans up.
 *
 * @module validate/environments/LocalEnvironment
 */

import { spawn, ChildProcess } from 'child_process';
import { logger } from '../../logger.js';
import type { Environment, EnvironmentResult, HealthCheck, ApiCheck } from '../types.js';

export interface LocalEnvironmentOptions {
  startupTimeoutMs?: number;
  healthCheckTimeoutMs?: number;
}

export class LocalEnvironment implements Environment {
  readonly name = 'local';
  private readonly log = logger.child('LocalEnvironment');
  private process: ChildProcess | null = null;

  constructor(private readonly options: LocalEnvironmentOptions = {}) {
    this.options.startupTimeoutMs = options.startupTimeoutMs ?? 30000;
    this.options.healthCheckTimeoutMs = options.healthCheckTimeoutMs ?? 5000;
  }

  async test(projectPath: string): Promise<EnvironmentResult> {
    this.log.info('Starting local environment test', { projectPath });

    const result: EnvironmentResult = {
      name: this.name,
      passed: false,
      startupTimeMs: 0,
      healthChecks: [],
      apiTests: [],
      logs: [],
    };

    // 1. Start the dev server
    const startTime = Date.now();
    const serverUrl = await this.startDevServer(projectPath, result.logs);
    result.startupTimeMs = Date.now() - startTime;

    if (!serverUrl) {
      result.error = 'Dev server failed to start';
      return result;
    }

    // 2. Health checks
    result.healthChecks = await this.runHealthChecks(serverUrl);

    // 3. API endpoint tests (if applicable)
    result.apiTests = await this.testApiEndpoints(projectPath, serverUrl);

    result.passed = result.healthChecks.every(h => h.passed);

    return result;
  }

  async cleanup(): Promise<void> {
    if (this.process && !this.process.killed) {
      try {
        process.kill(-this.process.pid!);
      } catch {
        this.process.kill('SIGKILL');
      }
      this.process = null;
    }
  }

  private async startDevServer(projectPath: string, logs: string[]): Promise<string | null> {
    return new Promise(resolve => {
      this.process = spawn('npm', ['run', 'dev'], {
        cwd: projectPath,
        shell: true,
      });

      let foundUrl: string | null = null;
      let hasResolved = false;
      const urlRegex = /http:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+/;
      const readyPatterns = [
        /ready in /i,
        /compiled successfully/i,
        /listening on/i,
        /started server on/i,
      ];

      const timeout = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          this.cleanup();
          resolve(null);
        }
      }, this.options.startupTimeoutMs);

      const checkOutput = (data: string) => {
        if (hasResolved) return;

        if (!foundUrl) {
          const match = data.match(urlRegex);
          if (match) foundUrl = match[0];
        }

        if (readyPatterns.some(p => p.test(data)) && foundUrl) {
          hasResolved = true;
          clearTimeout(timeout);
          setTimeout(() => resolve(foundUrl!), 500);
        }
      };

      this.process.stdout?.on('data', d => {
        const text = d.toString();
        logs.push(
          ...text
            .split('\n')
            .filter(Boolean)
            .map((l: string) => `[local] ${l}`)
        );
        checkOutput(text);
      });

      this.process.stderr?.on('data', d => {
        const text = d.toString();
        logs.push(
          ...text
            .split('\n')
            .filter(Boolean)
            .map((l: string) => `[local:err] ${l}`)
        );
        checkOutput(text);
      });

      this.process.on('close', () => {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timeout);
          resolve(null);
        }
      });
    });
  }

  private async runHealthChecks(url: string): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];

    // Root health check
    checks.push(await this.checkEndpoint(`${url}/`, 'root'));

    // Common health endpoints
    const healthPaths = ['/health', '/api/health', '/_health', '/status'];
    for (const path of healthPaths) {
      try {
        const resp = await this.fetchWithTimeout(
          `${url}${path}`,
          this.options.healthCheckTimeoutMs!
        );
        if (resp.ok) {
          checks.push({
            name: `health:${path}`,
            passed: true,
            message: `Health check passed at ${path}`,
            latencyMs: resp.latencyMs,
          });
          break; // Only need one health endpoint to pass
        }
      } catch {
        // endpoint doesn't exist, skip
      }
    }

    return checks;
  }

  private async checkEndpoint(url: string, name: string): Promise<HealthCheck> {
    try {
      const resp = await this.fetchWithTimeout(url, this.options.healthCheckTimeoutMs!);
      return {
        name,
        passed: resp.ok,
        message: resp.ok ? `HTTP ${resp.status}` : `HTTP ${resp.status}`,
        latencyMs: resp.latencyMs,
      };
    } catch (err) {
      return {
        name,
        passed: false,
        message: err instanceof Error ? err.message : String(err),
        latencyMs: 0,
      };
    }
  }

  private async testApiEndpoints(projectPath: string, serverUrl: string): Promise<ApiCheck[]> {
    const checks: ApiCheck[] = [];

    // Try to find API routes from the project
    try {
      const { access } = await import('fs/promises');
      const { join } = await import('path');

      const apiPaths = [
        join(projectPath, 'src', 'app', 'api'),
        join(projectPath, 'pages', 'api'),
        join(projectPath, 'src', 'routes'),
        join(projectPath, 'src', 'controllers'),
      ];

      for (const apiPath of apiPaths) {
        try {
          await access(apiPath);
          // Found an API directory - test GET on common endpoints
          const commonEndpoints = ['/api', '/api/health', '/api/status'];
          for (const endpoint of commonEndpoints) {
            try {
              const resp = await this.fetchWithTimeout(
                `${serverUrl}${endpoint}`,
                this.options.healthCheckTimeoutMs!
              );
              checks.push({
                endpoint,
                method: 'GET',
                status: resp.status,
                latencyMs: resp.latencyMs,
                passed: resp.ok,
              });
            } catch {
              // endpoint not found
            }
          }
          break;
        } catch {
          // api dir doesn't exist
        }
      }
    } catch {
      // skip API detection
    }

    return checks;
  }

  private async fetchWithTimeout(
    url: string,
    timeoutMs: number
  ): Promise<{ ok: boolean; status: number; latencyMs: number }> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { get } = url.startsWith('https') ? require('https') : require('http');

      const timeout = setTimeout(() => {
        reject(new Error(`Request to ${url} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      get(url, (res: any) => {
        clearTimeout(timeout);
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 400,
          status: res.statusCode,
          latencyMs: Date.now() - startTime,
        });
      }).on('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }
}
