/**
 * BuildValidator - Validates project build process
 *
 * Runs npm install, npm run build, and type checking to verify
 * the generated project compiles correctly.
 *
 * @module validate/validators/BuildValidator
 */

import { spawn } from 'child_process';
import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { logger } from '../../logger.js';
import type { BuildCheckResult } from '../types.js';

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface BuildValidatorOptions {
  installTimeoutMs?: number;
  buildTimeoutMs?: number;
}

interface ExecResult {
  success: boolean;
  duration: number;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class BuildValidator {
  private readonly log = logger.child('BuildValidator');
  private readonly installTimeoutMs: number;
  private readonly buildTimeoutMs: number;

  constructor(options: BuildValidatorOptions = {}) {
    this.installTimeoutMs = options.installTimeoutMs ?? 300000;
    this.buildTimeoutMs = options.buildTimeoutMs ?? 120000;
  }

  async validate(projectPath: string): Promise<BuildCheckResult> {
    this.log.info('Starting build validation', { projectPath });

    const result: BuildCheckResult = {
      passed: false,
      installTime: 0,
      buildTime: 0,
      errors: [],
      warnings: [],
    };

    // 1. Verify package.json exists
    const hasPackageJson = await this.fileExists(join(projectPath, 'package.json'));
    if (!hasPackageJson) {
      result.errors.push({
        type: 'BUILD_ERROR',
        severity: 'error',
        message: 'package.json not found in project root',
      });
      return result;
    }

    // 2. npm install
    this.log.debug('Running npm install...');
    const installStart = Date.now();
    const installResult = await this.exec('npm', ['install', '--no-audit', '--no-fund'], {
      cwd: projectPath,
      timeout: this.installTimeoutMs,
    });
    result.installTime = Date.now() - installStart;

    if (!installResult.success) {
      result.errors.push({
        type: 'BUILD_ERROR',
        severity: 'error',
        message: `npm install failed (exit ${installResult.exitCode}): ${installResult.stderr.slice(0, 500)}`,
      });
      return result;
    }

    // 3. Check if build script exists
    const packageJson = await this.readPackageJson(projectPath);
    const hasBuildScript = packageJson?.scripts?.build;
    const hasDevScript = packageJson?.scripts?.dev;

    if (!hasBuildScript && !hasDevScript) {
      result.warnings.push('No build or dev script found in package.json');
      result.passed = true;
      return result;
    }

    // 4. Run build (prefer build script)
    const buildScript = hasBuildScript ? 'build' : 'dev';
    this.log.debug(`Running npm run ${buildScript}...`);
    const buildStart = Date.now();

    if (buildScript === 'dev') {
      // For dev script, boot and kill after ready
      const devResult = await this.runDevUntilReady(projectPath);
      result.buildTime = Date.now() - buildStart;
      if (!devResult.success) {
        result.errors.push({
          type: 'BUILD_ERROR',
          severity: 'error',
          message: `Dev server failed: ${devResult.stderr.slice(0, 500)}`,
        });
        return result;
      }
    } else {
      const buildResult = await this.exec('npm', ['run', 'build'], {
        cwd: projectPath,
        timeout: this.buildTimeoutMs,
      });
      result.buildTime = Date.now() - buildStart;

      if (!buildResult.success) {
        result.errors.push({
          type: 'BUILD_ERROR',
          severity: 'error',
          message: `Build failed (exit ${buildResult.exitCode}): ${buildResult.stderr.slice(0, 500)}`,
        });

        // Extract warnings from build output
        this.extractWarnings(buildResult.stdout + buildResult.stderr, result.warnings);
        return result;
      }

      this.extractWarnings(buildResult.stdout + buildResult.stderr, result.warnings);
    }

    // 5. TypeScript type check (if tsconfig exists)
    const hasTsConfig = await this.fileExists(join(projectPath, 'tsconfig.json'));
    if (hasTsConfig) {
      this.log.debug('Running tsc --noEmit...');
      const typecheckResult = await this.exec('npx', ['tsc', '--noEmit'], {
        cwd: projectPath,
        timeout: 60000,
      });

      if (!typecheckResult.success) {
        // Type errors are warnings, not blockers
        result.warnings.push(`TypeScript errors found: ${typecheckResult.stderr.slice(0, 300)}`);
      }
    }

    // 6. Bundle size analysis
    result.bundleSize = await this.calculateBundleSize(projectPath);

    result.passed = result.errors.length === 0;
    this.log.info('Build validation complete', {
      passed: result.passed,
      installTime: result.installTime,
      buildTime: result.buildTime,
    });

    return result;
  }

  private async runDevUntilReady(projectPath: string): Promise<ExecResult> {
    return new Promise(resolve => {
      const startTime = Date.now();
      const child = spawn('npm', ['run', 'dev'], {
        cwd: projectPath,
        shell: true,
      });

      let stderr = '';
      let hasResolved = false;
      const readyPatterns = [
        /ready in /i,
        /compiled successfully/i,
        /listening on/i,
        /started server on/i,
      ];
      const urlRegex = /http:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+/;

      const timeout = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          this.cleanupProcess(child);
          resolve({
            success: false,
            duration: Date.now() - startTime,
            stdout: '',
            stderr: stderr || 'Dev server timed out',
            exitCode: -1,
          });
        }
      }, this.buildTimeoutMs);

      const checkOutput = (data: Buffer) => {
        if (hasResolved) return;

        const text = data.toString();

        // Check for URL pattern
        if (!urlRegex.test(text)) {
          // Still waiting for server to start
          return;
        }

        if (readyPatterns.some(p => p.test(text))) {
          hasResolved = true;
          clearTimeout(timeout);
          setTimeout(() => {
            this.cleanupProcess(child);
            resolve({
              success: true,
              duration: Date.now() - startTime,
              stdout: '',
              stderr: '',
              exitCode: 0,
            });
          }, 500);
        }
      };

      child.stdout?.on('data', checkOutput);
      child.stderr?.on('data', data => {
        const text = data.toString();
        stderr += text;
        checkOutput(Buffer.from(text));
      });

      child.on('close', code => {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timeout);
          this.cleanupProcess(child);
          resolve({
            success: false,
            duration: Date.now() - startTime,
            stdout: '',
            stderr: stderr || `Process exited with code ${code}`,
            exitCode: code ?? -1,
          });
        }
      });
    });
  }

  private cleanupProcess(child: import('child_process').ChildProcess): void {
    if (child && !child.killed && child.pid) {
      try {
        process.kill(-child.pid);
      } catch {
        child.kill('SIGKILL');
      }
    }
  }

  private extractWarnings(output: string, warnings: string[]): void {
    const lines = output.split('\n');
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes('warning') || lower.includes('deprecated') || lower.includes('peer dep')) {
        warnings.push(line.trim());
      }
    }
  }

  private async calculateBundleSize(projectPath: string): Promise<number | undefined> {
    const distPaths = ['dist', 'build', '.next', 'out'];
    for (const dir of distPaths) {
      const distPath = join(projectPath, dir);
      if (await this.fileExists(distPath)) {
        const size = await this.getDirSize(distPath);
        return size;
      }
    }
    return undefined;
  }

  private async getDirSize(dirPath: string): Promise<number> {
    let total = 0;
    try {
      const { readdir, stat } = await import('fs/promises');
      const entries = await readdir(dirPath);
      for (const entry of entries) {
        if (entry === 'node_modules' || entry === '.git') continue;
        const fullPath = join(dirPath, entry);
        const s = await stat(fullPath);
        if (s.isDirectory()) {
          total += await this.getDirSize(fullPath);
        } else {
          total += s.size;
        }
      }
    } catch {
      // skip unreadable dirs
    }
    return total;
  }

  private async readPackageJson(projectPath: string): Promise<PackageJson | null> {
    try {
      const content = await readFile(join(projectPath, 'package.json'), 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  private exec(
    cmd: string,
    args: string[],
    options: { cwd: string; timeout: number }
  ): Promise<ExecResult> {
    return new Promise(resolve => {
      const startTime = Date.now();
      const child = spawn(cmd, args, {
        cwd: options.cwd,
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        resolve({
          success: false,
          duration: Date.now() - startTime,
          stdout,
          stderr: stderr || 'Process timed out',
          exitCode: -1,
        });
      }, options.timeout);

      child.stdout?.on('data', d => {
        stdout += d.toString();
      });
      child.stderr?.on('data', d => {
        stderr += d.toString();
      });
      child.on('close', code => {
        clearTimeout(timeout);
        resolve({
          success: code === 0,
          duration: Date.now() - startTime,
          stdout,
          stderr,
          exitCode: code ?? -1,
        });
      });
      child.on('error', err => {
        clearTimeout(timeout);
        resolve({
          success: false,
          duration: Date.now() - startTime,
          stdout,
          stderr: err.message,
          exitCode: -1,
        });
      });
    });
  }
}
