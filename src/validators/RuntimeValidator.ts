/**
 * RuntimeValidator - Validates projects by attempting to install and run them
 *
 * Runs `npm install` and `npm run dev` to physically verify that a generated 
 * fallback project is structurally sound and runnable.
 */

import { spawn } from 'child_process';
import { logger } from '../logger.js';

export interface RuntimeValidationResult {
  valid: boolean;
  installSuccess: boolean;
  bootSuccess: boolean;
  logs: string[];
  serverUrl?: string;
  error?: string;
}

export interface RuntimeValidatorOptions {
  installTimeoutMs?: number;
  bootTimeoutMs?: number;
}

export class RuntimeValidator {
  private readonly log = logger.child('RuntimeValidator');
  
  // Regex to detect successfully bound dev server URLs
  private readonly urlRegex = /http:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+/;
  // Patterns indicating server is ready
  private readonly readyPatterns = [
    /ready in /i,
    /compiled successfully/i,
    /vite v.* ready/i,
    /started server on/i,
    /listening on/i,
    /http:\/\/(?:localhost|127\.0\.0\.1)/i
  ];

  constructor(private readonly options: RuntimeValidatorOptions = {}) {
    this.options.installTimeoutMs = this.options.installTimeoutMs ?? 60000; // 60s
    this.options.bootTimeoutMs = this.options.bootTimeoutMs ?? 15000;     // 15s
  }

  /**
   * Run full runtime validation (install + boot)
   * @param projectPath Absolute path to the generated project
   */
  async validate(projectPath: string): Promise<RuntimeValidationResult> {
    this.log.info('Starting runtime validation', { projectPath });
    
    const result: RuntimeValidationResult = {
      valid: false,
      installSuccess: false,
      bootSuccess: false,
      logs: []
    };

    try {
      // 1. Install dependencies
      this.log.debug('Running npm install...');
      await this.runInstall(projectPath, result.logs);
      result.installSuccess = true;

      // 2. Boot dev server
      this.log.debug('Starting dev server...');
      const serverUrl = await this.runDevServer(projectPath, result.logs);
      
      result.bootSuccess = true;
      result.serverUrl = serverUrl;
      result.valid = true;
      
      this.log.info('Runtime validation successful', { serverUrl });
    } catch (err) {
      this.log.error('Runtime validation failed', { error: err instanceof Error ? err.message : String(err) });
      result.error = err instanceof Error ? err.message : String(err);
      result.valid = false;
    }

    return result;
  }

  /**
   * Executes npm install in the target directory
   */
  private runInstall(projectPath: string, logs: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn('npm', ['install', '--no-audit', '--no-fund'], {
        cwd: projectPath,
        shell: true,
      });

      let stderrOutput = '';

      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`npm install timed out after ${this.options.installTimeoutMs}ms`));
      }, this.options.installTimeoutMs);

      child.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(Boolean);
        logs.push(...lines.map((l: string) => `[install] ${l}`));
      });

      child.stderr.on('data', (data) => {
        stderrOutput += data.toString();
        const lines = data.toString().split('\n').filter(Boolean);
        logs.push(...lines.map((l: string) => `[install:err] ${l}`));
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          // Some warnings go to stderr during successful installs, so only error if exit code != 0
          reject(new Error(`npm install failed with exit code ${code}. Error: ${stderrOutput.slice(0, 500)}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * Executes `npm run dev` and waits until a ready signal is emitted or timeout happens
   * Kills child process before returning
   */
  private runDevServer(projectPath: string, logs: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('npm', ['run', 'dev'], {
        cwd: projectPath,
        shell: true,
      });

      let foundUrl: string | null = null;
      let hasResolved = false;

      const cleanup = () => {
        if (!child.killed) {
          // Needs kill -9 to stop child processes spawned by npm
          try {
            process.kill(-child.pid!); // Ensure we kill the process group (requires detached: true if doing this, or just kill the child)
          } catch (e) {
            child.kill('SIGKILL');
          }
        }
      };

      const timeout = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          cleanup();
          reject(new Error(`Dev server boot timed out after ${this.options.bootTimeoutMs}ms`));
        }
      }, this.options.bootTimeoutMs);

      const checkOutput = (data: string) => {
        if (hasResolved) return;
        
        // Find URL
        if (!foundUrl) {
          const match = data.match(this.urlRegex);
          if (match) {
            foundUrl = match[0];
          }
        }

        // Check if ready
        const isReady = this.readyPatterns.some(pattern => pattern.test(data));
        if (isReady && foundUrl) {
          hasResolved = true;
          clearTimeout(timeout);
          // Wait a tiny bit for the server to fully bind before killing it and returning
          setTimeout(() => {
             cleanup();
             resolve(foundUrl!);
          }, 500);
        }
      };

      child.stdout.on('data', (data) => {
        const text = data.toString();
        const lines = text.split('\n').filter(Boolean);
        logs.push(...lines.map((l: string) => `[dev] ${l}`));
        checkOutput(text);
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        const lines = text.split('\n').filter(Boolean);
        logs.push(...lines.map((l: string) => `[dev:err] ${l}`));
        
        // Some frameworks log the ready message to stderr
        checkOutput(text);
      });

      child.on('close', (code) => {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timeout);
          reject(new Error(`Dev server exited prematurely with code ${code}`));
        }
      });

      child.on('error', (err) => {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timeout);
          reject(err);
        }
      });
    });
  }
}
