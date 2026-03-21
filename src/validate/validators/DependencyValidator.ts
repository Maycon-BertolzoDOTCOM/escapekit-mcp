/**
 * DependencyValidator - Validates project dependencies
 *
 * Detects ghost packages, runs npm audit, checks version conflicts
 * and missing peer dependencies.
 *
 * @module validate/validators/DependencyValidator
 */

import { spawn } from 'child_process';
import { readFile, access, readdir } from 'fs/promises';
import { join } from 'path';
import { logger } from '../../logger.js';
interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface VulnerabilityInfo {
  severity?: string;
  via?: Array<{ title?: string; url?: string }>;
  fixAvailable?: boolean;
}

interface OutdatedInfo {
  current?: string;
  wanted?: string;
  latest?: string;
}

import type {
  DependencyCheckResult,
  GhostPackage,
  OutdatedPackage,
  Vulnerability,
} from '../types.js';

export class DependencyValidator {
  private readonly log = logger.child('DependencyValidator');

  private readonly defaultGhostPatterns = [
    /^fake-/,
    /^mock-/,
    /^sandbox-/,
    /^claude-/,
    /^replit-/,
    /^codesandbox-/,
    /-fake$/,
    /-mock$/,
    /-sandbox$/,
  ];

  async validate(projectPath: string): Promise<DependencyCheckResult> {
    this.log.info('Starting dependency validation', { projectPath });

    const packageJson = await this.readPackageJson(projectPath);
    if (!packageJson) {
      return {
        passed: false,
        ghostPackages: [],
        outdatedPackages: [],
        vulnerabilities: [],
        missingPeerDeps: ['package.json not found'],
      };
    }

    // 1. Check ghost packages
    const ghostPackages = await this.checkGhostPackages(projectPath, packageJson);

    // 2. npm audit
    const vulnerabilities = await this.runNpmAudit(projectPath);

    // 3. Check outdated packages
    const outdatedPackages = await this.checkOutdated(projectPath);

    // 4. Check peer dependencies
    const missingPeerDeps = await this.checkPeerDeps(projectPath);

    const passed =
      ghostPackages.length === 0 && !vulnerabilities.some(v => v.severity === 'critical');

    this.log.info('Dependency validation complete', {
      passed,
      ghosts: ghostPackages.length,
      vulns: vulnerabilities.length,
      outdated: outdatedPackages.length,
    });

    return { passed, ghostPackages, outdatedPackages, vulnerabilities, missingPeerDeps };
  }

  async checkGhostPackages(
    projectPath: string,
    packageJson?: PackageJson
  ): Promise<GhostPackage[]> {
    const pkg = packageJson || (await this.readPackageJson(projectPath));
    if (!pkg) return [];

    const sourceFiles = await this.findSourceFiles(projectPath);
    const ghosts: GhostPackage[] = [];

    for (const file of sourceFiles) {
      const fullPath = join(projectPath, file);
      try {
        const content = await readFile(fullPath, 'utf-8');
        const imports = this.extractImports(content);

        for (const { importPath, line } of imports) {
          // Skip relative imports
          if (importPath.startsWith('.') || importPath.startsWith('/')) continue;

          // Check against ghost patterns
          const isGhost = this.defaultGhostPatterns.some(p => p.test(importPath));
          if (isGhost) {
            ghosts.push({
              name: importPath,
              importPath,
              file,
              line,
              suggestedReplacement: this.suggestReplacement(importPath),
            });
          }
        }
      } catch {
        // skip unreadable files
      }
    }

    return ghosts;
  }

  private async runNpmAudit(projectPath: string): Promise<Vulnerability[]> {
    const result = await this.exec('npm', ['audit', '--json'], {
      cwd: projectPath,
      timeout: 30000,
    });

    if (!result.stdout.trim()) return [];

    try {
      const audit = JSON.parse(result.stdout);
      const vulnerabilities: Vulnerability[] = [];

      if (audit.vulnerabilities) {
        for (const [name, vuln] of Object.entries(audit.vulnerabilities as Record<string, VulnerabilityInfo>)) {
          vulnerabilities.push({
            name,
            severity: (vuln.severity && ['critical', 'high', 'moderate', 'low'].includes(vuln.severity) ? vuln.severity : 'moderate') as 'critical' | 'high' | 'moderate' | 'low',
            title: typeof vuln.via?.[0] === 'string' ? vuln.via[0] : vuln.via?.[0]?.title || 'Unknown vulnerability',
            url: vuln.via?.[0]?.url,
            fixAvailable: !!vuln.fixAvailable,
          });
        }
      }

      return vulnerabilities;
    } catch {
      return [];
    }
  }

  private async checkOutdated(projectPath: string): Promise<OutdatedPackage[]> {
    const result = await this.exec('npm', ['outdated', '--json'], {
      cwd: projectPath,
      timeout: 30000,
    });

    if (!result.stdout.trim()) return [];

    try {
      const outdated = JSON.parse(result.stdout);
      return Object.entries(outdated as Record<string, OutdatedInfo>).map(([name, info]) => ({
        name,
        current: info.current || 'unknown',
        wanted: info.wanted || 'unknown',
        latest: info.latest || 'unknown',
      }));
    } catch {
      return [];
    }
  }

  private async checkPeerDeps(projectPath: string): Promise<string[]> {
    const nodeModulesPath = join(projectPath, 'node_modules');
    const missing: string[] = [];

    try {
      await access(nodeModulesPath);
    } catch {
      return [];
    }

    // Check for peer dep warnings in npm install output (cached via package.json)
    const result = await this.exec('npm', ['ls', '--json'], {
      cwd: projectPath,
      timeout: 15000,
    });

    if (result.stderr.includes('peer dep')) {
      const lines = result.stderr.split('\n');
      for (const line of lines) {
        if (line.includes('peer dep')) {
          missing.push(line.trim());
        }
      }
    }

    return missing;
  }

  private extractImports(code: string): Array<{ importPath: string; line: number }> {
    const results: Array<{ importPath: string; line: number }> = [];
    const lines = code.split('\n');
    const importRegex =
      /(?:import\s+.*?\s+from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

    for (let i = 0; i < lines.length; i++) {
      let match: RegExpExecArray | null;
      importRegex.lastIndex = 0;
      while ((match = importRegex.exec(lines[i])) !== null) {
        const importPath = match[1] ?? match[2];
        if (importPath) {
          results.push({ importPath, line: i + 1 });
        }
      }
    }

    return results;
  }

  private suggestReplacement(ghostImport: string): string | undefined {
    const replacements: Record<string, string> = {
      'fake-api': 'axios',
      'mock-fetch': 'node-fetch',
      'sandbox-utils': 'lodash',
      'claude-api': '@anthropic-ai/sdk',
      'replit-db': 'better-sqlite3',
    };
    return replacements[ghostImport];
  }

  private async findSourceFiles(projectPath: string): Promise<string[]> {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
    const files: string[] = [];

    const walk = async (dir: string, relative: string): Promise<void> => {
      try {
        const entries = await readdir(dir);
        for (const entry of entries) {
          if (entry === 'node_modules' || entry === 'dist' || entry === '.git' || entry === '.next')
            continue;
          const fullPath = join(dir, entry);
          const relPath = relative ? `${relative}/${entry}` : entry;
          const { stat } = await import('fs/promises');
          try {
            const s = await stat(fullPath);
            if (s.isDirectory()) {
              await walk(fullPath, relPath);
            } else if (extensions.some(ext => entry.endsWith(ext))) {
              files.push(relPath);
            }
          } catch {
            // skip
          }
        }
      } catch {
        // skip
      }
    };

    const srcPath = join(projectPath, 'src');
    try {
      await access(srcPath);
      await walk(srcPath, 'src');
    } catch {
      await walk(projectPath, '');
    }

    return files;
  }

  private async readPackageJson(projectPath: string): Promise<PackageJson | null> {
    try {
      const content = await readFile(join(projectPath, 'package.json'), 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private exec(
    cmd: string,
    args: string[],
    options: { cwd: string; timeout: number }
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise(resolve => {
      const child = spawn(cmd, args, { cwd: options.cwd, shell: true });
      let stdout = '';
      let stderr = '';

      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        resolve({ stdout, stderr: stderr || 'Timeout', exitCode: -1 });
      }, options.timeout);

      child.stdout?.on('data', d => (stdout += d.toString()));
      child.stderr?.on('data', d => (stderr += d.toString()));
      child.on('close', code => {
        clearTimeout(timeout);
        resolve({ stdout, stderr, exitCode: code ?? -1 });
      });
      child.on('error', err => {
        clearTimeout(timeout);
        resolve({ stdout, stderr: err.message, exitCode: -1 });
      });
    });
  }
}
