/**
 * DockerEnvironment - Runs tests in a Docker container
 *
 * Builds a Docker image from the project, runs it, executes health checks
 * against the containerized app, then cleans up.
 *
 * @module validate/environments/DockerEnvironment
 */

import { spawn } from 'child_process';
import { logger } from '../../logger.js';
import type { Environment, EnvironmentResult, HealthCheck, ApiCheck } from '../types.js';

export interface DockerEnvironmentOptions {
  port?: number;
  startupTimeoutMs?: number;
  healthCheckTimeoutMs?: number;
  imageName?: string;
}

export class DockerEnvironment implements Environment {
  readonly name = 'docker';
  private readonly log = logger.child('DockerEnvironment');
  private containerId: string | null = null;
  private readonly port: number;
  private readonly imageName: string;

  constructor(private readonly options: DockerEnvironmentOptions = {}) {
    this.port = options.port ?? 3000;
    this.imageName = options.imageName ?? 'escapekit-validate';
    this.options.startupTimeoutMs = options.startupTimeoutMs ?? 60000;
    this.options.healthCheckTimeoutMs = options.healthCheckTimeoutMs ?? 5000;
  }

  async test(projectPath: string): Promise<EnvironmentResult> {
    this.log.info('Starting Docker environment test', { projectPath });

    const result: EnvironmentResult = {
      name: this.name,
      passed: false,
      startupTimeMs: 0,
      healthChecks: [],
      apiTests: [],
      logs: [],
    };

    // 0. Check Docker is available
    const dockerCheck = await this.exec('docker', ['--version'], { timeout: 5000 });
    if (!dockerCheck.success) {
      result.error = 'Docker is not available. Install Docker to use --env docker';
      result.logs.push(result.error);
      return result;
    }

    // 1. Generate Dockerfile if not present
    const { access, writeFile } = await import('fs/promises');
    const { join } = await import('path');
    const dockerfilePath = join(projectPath, 'Dockerfile');

    let hasDockerfile = false;
    try {
      await access(dockerfilePath);
      hasDockerfile = true;
    } catch {
      // Generate a basic Dockerfile
      const dockerfile = await this.generateDockerfile(projectPath);
      if (dockerfile) {
        await writeFile(dockerfilePath, dockerfile, 'utf-8');
        result.logs.push('[docker] Generated Dockerfile');
        hasDockerfile = true;
      }
    }

    if (!hasDockerfile) {
      result.error = 'Could not find or generate Dockerfile';
      return result;
    }

    // 2. Build Docker image
    const startTime = Date.now();
    result.logs.push('[docker] Building image...');
    const buildResult = await this.exec('docker', ['build', '-t', this.imageName, projectPath], {
      timeout: 180000,
    });

    if (!buildResult.success) {
      result.error = `Docker build failed: ${buildResult.stderr.slice(0, 500)}`;
      result.logs.push(`[docker:build] ${buildResult.stderr.slice(0, 500)}`);
      return result;
    }

    // 3. Run container
    result.logs.push('[docker] Starting container...');
    const containerId = await this.startContainer();
    if (!containerId) {
      result.error = 'Failed to start container';
      return result;
    }

    // 4. Wait for container to be ready
    const serverUrl = `http://localhost:${this.port}`;
    const ready = await this.waitForReady(serverUrl, this.options.startupTimeoutMs!);
    result.startupTimeMs = Date.now() - startTime;

    if (!ready) {
      result.error = 'Container failed to become ready';
      const logs = await this.getContainerLogs();
      result.logs.push(...logs);
      await this.cleanup();
      return result;
    }

    // 5. Health checks
    result.healthChecks = await this.runHealthChecks(serverUrl);

    // 6. API tests
    result.apiTests = await this.testApiEndpoints(serverUrl);

    // 7. Get container logs
    const containerLogs = await this.getContainerLogs();
    result.logs.push(...containerLogs.slice(0, 50));

    result.passed = result.healthChecks.every(h => h.passed);

    // 8. Cleanup
    await this.cleanup();

    return result;
  }

  async cleanup(): Promise<void> {
    if (this.containerId) {
      this.log.debug('Cleaning up container', { containerId: this.containerId });
      await this.exec('docker', ['rm', '-f', this.containerId], { timeout: 10000 });
      this.containerId = null;
    }
  }

  private async startContainer(): Promise<string | null> {
    const result = await this.exec(
      'docker',
      [
        'run',
        '-d',
        '-p',
        `${this.port}:${this.port}`,
        '--name',
        `escapekit-validate-${Date.now()}`,
        this.imageName,
      ],
      { timeout: 15000 }
    );

    if (result.success) {
      this.containerId = result.stdout.trim();
      return this.containerId;
    }
    return null;
  }

  private async waitForReady(url: string, timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    const interval = 2000;

    while (Date.now() - start < timeoutMs) {
      try {
        const resp = await this.fetchWithTimeout(url, 3000);
        if (resp.ok) return true;
      } catch {
        // not ready yet
      }
      await this.sleep(interval);
    }
    return false;
  }

  private async runHealthChecks(url: string): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];
    const paths = ['/', '/health', '/api/health', '/_health', '/status'];

    for (const path of paths) {
      try {
        const resp = await this.fetchWithTimeout(
          `${url}${path}`,
          this.options.healthCheckTimeoutMs!
        );
        checks.push({
          name: `docker:${path}`,
          passed: resp.ok,
          message: `HTTP ${resp.status}`,
          latencyMs: resp.latencyMs,
        });
        if (resp.ok) break;
      } catch {
        // endpoint doesn't exist
      }
    }

    return checks;
  }

  private async testApiEndpoints(url: string): Promise<ApiCheck[]> {
    const endpoints = ['/api', '/api/health', '/api/status'];
    const checks: ApiCheck[] = [];

    for (const endpoint of endpoints) {
      try {
        const resp = await this.fetchWithTimeout(
          `${url}${endpoint}`,
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
        // not found
      }
    }

    return checks;
  }

  private async getContainerLogs(): Promise<string[]> {
    if (!this.containerId) return [];

    const result = await this.exec('docker', ['logs', '--tail', '100', this.containerId], {
      timeout: 5000,
    });
    if (result.success) {
      return result.stdout
        .split('\n')
        .filter(Boolean)
        .map((l: string) => `[docker] ${l}`);
    }
    return [];
  }

  private async generateDockerfile(projectPath: string): Promise<string | null> {
    try {
      const { readFile } = await import('fs/promises');
      const { join } = await import('path');
      const pkg = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf-8'));

      const buildScript = pkg.scripts?.build;
      const startScript = pkg.scripts?.start || pkg.scripts?.dev;

      let nodeVersion = '18';
      if (pkg.engines?.node) {
        const match = pkg.engines.node.match(/(\d+)/);
        if (match) nodeVersion = match[1];
      }

      return `FROM node:${nodeVersion}-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
${buildScript ? 'RUN npm run build' : ''}

FROM node:${nodeVersion}-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
${buildScript ? 'COPY --from=builder /app/dist ./dist\nCOPY --from=builder /app/build ./build' : 'COPY . .'}
ENV NODE_ENV=production
ENV PORT=${this.port}
EXPOSE ${this.port}
${startScript ? `CMD ["npm", "run", "${startScript}"]` : 'CMD ["node", "index.js"]'}
`;
    } catch {
      return null;
    }
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
        reject(new Error(`Request to ${url} timed out`));
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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private exec(
    cmd: string,
    args: string[],
    options: { timeout: number }
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    return new Promise(resolve => {
      const child = spawn(cmd, args, { shell: true });
      let stdout = '';
      let stderr = '';

      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        resolve({ success: false, stdout, stderr: stderr || 'Timeout' });
      }, options.timeout);

      child.stdout?.on('data', d => (stdout += d.toString()));
      child.stderr?.on('data', d => (stderr += d.toString()));
      child.on('close', code => {
        clearTimeout(timeout);
        resolve({ success: code === 0, stdout, stderr });
      });
      child.on('error', err => {
        clearTimeout(timeout);
        resolve({ success: false, stdout, stderr: err.message });
      });
    });
  }
}
