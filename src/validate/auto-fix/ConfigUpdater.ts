/**
 * ConfigUpdater - Updates build tool configurations
 *
 * Fixes outdated or incorrect configurations in vite.config, webpack.config,
 * tsconfig, next.config, etc.
 *
 * @module validate/auto-fix/ConfigUpdater
 */

import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { logger } from '../../logger.js';
import type { Fix, Issue, Fixer } from '../types.js';

export class ConfigUpdater implements Fixer {
  private readonly log = logger.child('ConfigUpdater');

  async fix(projectPath: string, issue: Issue): Promise<Fix> {
    this.log.info('Attempting config update', { message: issue.message });

    // Determine which config to update
    const configFile = issue.file || (await this.detectConfigFile(projectPath));

    if (!configFile) {
      return {
        issueType: issue.type,
        description: 'No config file found to update',
        applied: false,
        error: 'Config file not found',
      };
    }

    const fullPath = join(projectPath, configFile);

    try {
      await access(fullPath);
    } catch {
      return {
        issueType: issue.type,
        description: `Config file not found: ${configFile}`,
        applied: false,
        error: 'File not found',
      };
    }

    // Route to appropriate updater
    if (configFile.includes('tsconfig')) {
      return this.updateTsConfig(fullPath, issue);
    }
    if (configFile.includes('vite.config')) {
      return this.updateViteConfig(fullPath, issue);
    }
    if (configFile.includes('next.config')) {
      return this.updateNextConfig(fullPath, issue);
    }
    if (configFile.includes('package.json')) {
      return this.updatePackageJson(fullPath, issue);
    }

    return {
      issueType: issue.type,
      description: `Unknown config type: ${configFile}`,
      file: configFile,
      applied: false,
      error: 'Unsupported config file',
    };
  }

  private async detectConfigFile(projectPath: string): Promise<string | null> {
    const candidates = [
      'tsconfig.json',
      'vite.config.ts',
      'vite.config.js',
      'next.config.js',
      'next.config.mjs',
      'webpack.config.js',
      'package.json',
    ];

    for (const candidate of candidates) {
      try {
        await access(join(projectPath, candidate));
        return candidate;
      } catch {
        continue;
      }
    }
    return null;
  }

  private async updateTsConfig(filePath: string, issue: Issue): Promise<Fix> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const tsconfig = JSON.parse(content);
      let changed = false;

      // Fix common tsconfig issues
      if (!tsconfig.compilerOptions) {
        tsconfig.compilerOptions = {};
        changed = true;
      }

      // Ensure module and target are set
      if (!tsconfig.compilerOptions.module) {
        tsconfig.compilerOptions.module = 'ESNext';
        changed = true;
      }
      if (!tsconfig.compilerOptions.target) {
        tsconfig.compilerOptions.target = 'ES2020';
        changed = true;
      }
      if (!tsconfig.compilerOptions.moduleResolution) {
        tsconfig.compilerOptions.moduleResolution = 'bundler';
        changed = true;
      }
      if (tsconfig.compilerOptions.strict === undefined) {
        tsconfig.compilerOptions.strict = true;
        changed = true;
      }

      // Ensure paths for baseUrl resolution
      if (issue.message.includes('baseUrl') || issue.message.includes('paths')) {
        if (!tsconfig.compilerOptions.baseUrl) {
          tsconfig.compilerOptions.baseUrl = '.';
          changed = true;
        }
      }

      if (changed) {
        await writeFile(filePath, JSON.stringify(tsconfig, null, 2), 'utf-8');
        return {
          issueType: issue.type,
          description: 'Updated tsconfig.json with recommended compiler options',
          file: 'tsconfig.json',
          applied: true,
        };
      }

      return {
        issueType: issue.type,
        description: 'tsconfig.json already has correct configuration',
        file: 'tsconfig.json',
        applied: false,
      };
    } catch (err) {
      return {
        issueType: issue.type,
        description: `Failed to update tsconfig: ${err instanceof Error ? err.message : String(err)}`,
        file: 'tsconfig.json',
        applied: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async updateViteConfig(filePath: string, issue: Issue): Promise<Fix> {
    try {
      let content = await readFile(filePath, 'utf-8');
      let changed = false;

      // Add resolve.alias if missing (common ghost import fix)
      if (issue.message.includes('resolve') || issue.message.includes('alias')) {
        if (!content.includes('resolve')) {
          content = content.replace(
            /export default defineConfig\(\{/,
            `export default defineConfig({\n  resolve: {\n    alias: {\n      '@': '/src',\n    },\n  },`
          );
          changed = true;
        }
      }

      // Add optimizeDeps if missing
      if (issue.message.includes('optimizeDeps') || issue.message.includes('pre-bundle')) {
        if (!content.includes('optimizeDeps')) {
          content = content.replace(
            /export default defineConfig\(\{/,
            `export default defineConfig({\n  optimizeDeps: {\n    include: [],\n  },`
          );
          changed = true;
        }
      }

      if (changed) {
        await writeFile(filePath, content, 'utf-8');
        return {
          issueType: issue.type,
          description: 'Updated vite.config with fix',
          file: filePath,
          applied: true,
        };
      }

      return {
        issueType: issue.type,
        description: 'No vite.config changes needed',
        applied: false,
      };
    } catch (err) {
      return {
        issueType: issue.type,
        description: `Failed to update vite config: ${err instanceof Error ? err.message : String(err)}`,
        applied: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async updateNextConfig(filePath: string, issue: Issue): Promise<Fix> {
    try {
      let content = await readFile(filePath, 'utf-8');

      // Add transpilePackages if missing
      if (!content.includes('transpilePackages')) {
        const hasModuleExports = content.includes('module.exports');
        if (hasModuleExports) {
          content = content.replace(
            /module\.exports\s*=\s*\{/,
            `module.exports = {\n  transpilePackages: [],`
          );
        }
        await writeFile(filePath, content, 'utf-8');
        return {
          issueType: issue.type,
          description: 'Updated next.config with transpilePackages',
          file: 'next.config.js',
          applied: true,
        };
      }

      return {
        issueType: issue.type,
        description: 'No next.config changes needed',
        applied: false,
      };
    } catch (err) {
      return {
        issueType: issue.type,
        description: `Failed to update next config: ${err instanceof Error ? err.message : String(err)}`,
        applied: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async updatePackageJson(filePath: string, issue: Issue): Promise<Fix> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const pkg = JSON.parse(content);
      let changed = false;

      // Ensure engines field
      if (!pkg.engines) {
        pkg.engines = { node: '>=18.0.0' };
        changed = true;
      }

      // Ensure scripts
      if (!pkg.scripts) {
        pkg.scripts = {};
        changed = true;
      }

      if (changed) {
        await writeFile(filePath, JSON.stringify(pkg, null, 2), 'utf-8');
        return {
          issueType: issue.type,
          description: 'Updated package.json structure',
          file: 'package.json',
          applied: true,
        };
      }

      return {
        issueType: issue.type,
        description: 'No package.json changes needed',
        applied: false,
      };
    } catch (err) {
      return {
        issueType: issue.type,
        description: `Failed to update package.json: ${err instanceof Error ? err.message : String(err)}`,
        applied: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
