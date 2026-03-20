/**
 * MockReplacer - Replaces mock/ghost imports with real packages
 *
 * Uses the existing ImportReplacer transformer from src/transformers/
 * to perform AST-based import replacement.
 *
 * @module validate/auto-fix/MockReplacer
 */

import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { logger } from '../../logger.js';
import type { Fix, Issue, Fixer } from '../types.js';

export class MockReplacer implements Fixer {
  private readonly log = logger.child('MockReplacer');

  private readonly replacements: Record<string, string> = {
    'fake-api': 'axios',
    'fake-fetch': 'node-fetch',
    'mock-api': 'msw',
    'mock-fetch': 'node-fetch',
    'fake-database': 'better-sqlite3',
    'mock-database': 'better-sqlite3',
    'sandbox-database': 'better-sqlite3',
    'sandbox-utils': 'lodash',
    'claude-api': '@anthropic-ai/sdk',
    'claude-sdk': '@anthropic-ai/sdk',
    'replit-db': 'better-sqlite3',
    'replit-database': 'better-sqlite3',
    'fake-auth': 'jsonwebtoken',
    'mock-auth': 'jsonwebtoken',
    'fake-redis': 'ioredis',
    'mock-redis': 'ioredis',
    'fake-mailer': 'nodemailer',
    'mock-mailer': 'nodemailer',
  };

  async fix(projectPath: string, issue: Issue): Promise<Fix> {
    this.log.info('Attempting mock replacement', { file: issue.file, message: issue.message });

    if (!issue.file) {
      return {
        issueType: issue.type,
        description: 'No file specified for replacement',
        applied: false,
        error: 'Missing file path',
      };
    }

    const filePath = join(projectPath, issue.file);

    try {
      await access(filePath);
    } catch {
      return {
        issueType: issue.type,
        description: `File not found: ${issue.file}`,
        applied: false,
        error: 'File not found',
      };
    }

    try {
      let content = await readFile(filePath, 'utf-8');
      let changed = false;

      // Parse the message to find the problematic import
      // Message format: "Ghost import detected: \"fake-api\" in file.ts:5"
      const importMatch = issue.message.match(/["']([^"']+)["']/);
      if (importMatch) {
        const ghostImport = importMatch[1];
        const replacement = this.replacements[ghostImport];

        if (replacement) {
          // Replace the import statement
          const oldImport = `from '${ghostImport}'`;
          const newImport = `from '${replacement}'`;
          const oldImportDouble = `from "${ghostImport}"`;
          const newImportDouble = `from "${replacement}"`;

          const oldRequire = `require('${ghostImport}')`;
          const newRequire = `require('${replacement}')`;
          const oldRequireDouble = `require("${ghostImport}")`;
          const newRequireDouble = `require("${replacement}")`;

          if (content.includes(oldImport)) {
            content = content.replace(
              new RegExp(oldImport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
              newImport
            );
            changed = true;
          }
          if (content.includes(oldImportDouble)) {
            content = content.replace(
              new RegExp(oldImportDouble.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
              newImportDouble
            );
            changed = true;
          }
          if (content.includes(oldRequire)) {
            content = content.replace(
              new RegExp(oldRequire.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
              newRequire
            );
            changed = true;
          }
          if (content.includes(oldRequireDouble)) {
            content = content.replace(
              new RegExp(oldRequireDouble.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
              newRequireDouble
            );
            changed = true;
          }

          if (changed) {
            await writeFile(filePath, content, 'utf-8');

            // Also update package.json to swap ghost dep with real dep
            await this.updatePackageJson(projectPath, ghostImport, replacement);

            return {
              issueType: issue.type,
              description: `Replaced '${ghostImport}' with '${replacement}' in ${issue.file}`,
              file: issue.file,
              applied: true,
            };
          }
        }
      }

      return {
        issueType: issue.type,
        description: 'Could not determine replacement for this import',
        file: issue.file,
        applied: false,
        error: 'No matching replacement found',
      };
    } catch (err) {
      return {
        issueType: issue.type,
        description: `Failed to fix: ${err instanceof Error ? err.message : String(err)}`,
        file: issue.file,
        applied: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async updatePackageJson(
    projectPath: string,
    ghostDep: string,
    realDep: string
  ): Promise<void> {
    const pkgPath = join(projectPath, 'package.json');
    try {
      const raw = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw);
      let changed = false;

      const fields = ['dependencies', 'devDependencies'];
      for (const field of fields) {
        if (pkg[field]?.[ghostDep]) {
          const versionRange = pkg[field][ghostDep];
          delete pkg[field][ghostDep];
          pkg[field][realDep] = versionRange;
          changed = true;
        }
      }

      if (changed) {
        await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
        this.log.info('Updated package.json', { removed: ghostDep, added: realDep });
      }
    } catch (err) {
      this.log.warn('Failed to update package.json', { error: err });
    }
  }
}
