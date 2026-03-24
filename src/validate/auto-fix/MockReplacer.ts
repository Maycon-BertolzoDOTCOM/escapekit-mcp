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
import type { KnowledgeBase } from '../../resolvers/KnowledgeBase.js';
import type { SemanticMatcher } from '../../resolvers/SemanticMatcher.js';
import type { NPMRegistry } from '../../resolvers/NPMRegistry.js';

interface MockReplacerDeps {
  knowledgeBase?: KnowledgeBase;
  semanticMatcher?: SemanticMatcher;
  npmRegistry?: NPMRegistry;
}

export class MockReplacer implements Fixer {
  private readonly log = logger.child('MockReplacer');
  private readonly knowledgeBase?: KnowledgeBase;
  private readonly semanticMatcher?: SemanticMatcher;
  private readonly npmRegistry?: NPMRegistry;
  private kbInitialized = false;

  constructor(deps: MockReplacerDeps = {}) {
    this.knowledgeBase = deps.knowledgeBase;
    this.semanticMatcher = deps.semanticMatcher;
    this.npmRegistry = deps.npmRegistry;
  }

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
      const ghostImport = this.extractGhostImport(issue.message);
      if (!ghostImport) {
        return {
          issueType: issue.type,
          description: 'Could not extract ghost import from issue message',
          file: issue.file,
          applied: false,
          error: 'Invalid issue message format',
        };
      }

      // Try to resolve replacement using dynamic resolution chain
      const resolution = await this.resolveReplacement(ghostImport);
      
      // Handle special case where package exists in registry but we don't want to auto-replace
      if (resolution?.strategy === 'npm-registry-verified') {
        return {
          issueType: issue.type,
          description: `Package exists in registry but not auto-replaced: ${ghostImport}`,
          file: issue.file,
          applied: false,
          error: 'Package exists in registry',
        };
      }

      if (resolution) {
        return await this.applyReplacement(projectPath, issue, ghostImport, resolution.realPackage, resolution.strategy);
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

  private extractGhostImport(message: string): string | null {
    // Message format: "Ghost import detected: \"fake-api\" in file.ts:5"
    const importMatch = message.match(/["']([^"']+)["']/);
    return importMatch ? importMatch[1] : null;
  }

      const ghostImport = this.extractGhostImport(issue.message);
      if (ghostImport) {
        const replacement = this.replacements[ghostImport];

  private async applyReplacement(
    projectPath: string,
    issue: Issue,
    ghostImport: string,
    realPackage: string,
    strategy: string
  ): Promise<Fix> {
    const filePath = join(projectPath, issue.file!);
    let content = await readFile(filePath, 'utf-8');
    let changed = false;

    // Replace the import statement
    const oldImport = `from '${ghostImport}'`;
    const newImport = `from '${realPackage}'`;
    const oldImportDouble = `from "${ghostImport}"`;
    const newImportDouble = `from "${realPackage}"`;

    const oldRequire = `require('${ghostImport}')`;
    const newRequire = `require('${realPackage}')`;
    const oldRequireDouble = `require("${ghostImport}")`;
    const newRequireDouble = `require("${realPackage}")`;

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
      await this.updatePackageJson(projectPath, ghostImport, realPackage);

      return {
        issueType: issue.type,
        description: `Replaced '${ghostImport}' with '${realPackage}' in ${issue.file}`,
        file: issue.file,
        applied: true,
      };
    }

    return {
      issueType: issue.type,
      description: 'No matching import pattern found',
      file: issue.file,
      applied: false,
      error: 'No matching import pattern',
    };
  }

        if (replacement) {
          const fix = await this.applyReplacement(projectPath, issue, ghostImport, replacement, 'hardcoded');
          if (fix.applied) {
            return fix;
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

  private async resolveReplacement(ghostImport: string): Promise<{ realPackage: string; strategy: string } | null> {
    // Step 1: Check KnowledgeBase
    if (this.knowledgeBase && !this.kbInitialized) {
      try {
        await this.knowledgeBase.loadFromFile('knowledge-base.json');
        this.kbInitialized = true;
        this.log.info('Successfully loaded knowledge-base.json');
      } catch (err) {
        this.log.warn('Failed to load knowledge-base.json', {
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    if (this.knowledgeBase && this.kbInitialized) {
      const mapping = this.knowledgeBase.getMapping(ghostImport);
      if (mapping) {
        this.log.info('Found replacement in KnowledgeBase', {
          ghostImport,
          realPackage: mapping.realPackages[0],
          confidence: mapping.confidence
        });
        return {
          realPackage: mapping.realPackages[0],
          strategy: 'knowledge-base'
        };
      }
    }

    // Step 2: Check SemanticMatcher
    if (this.semanticMatcher) {
      try {
        const results = await this.semanticMatcher.findSimilar(ghostImport, {
          minSimilarity: 0.7,
          maxResults: 1
        });

        if (results.length > 0) {
          this.log.info('Found semantic match', {
            ghostImport,
            realPackage: results[0].realPackages[0],
            confidence: results[0].confidence
          });
          return {
            realPackage: results[0].realPackages[0],
            strategy: 'semantic-match'
          };
        }
      } catch (err) {
        this.log.warn('SemanticMatcher failed', {
          ghostImport,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    // Step 3: Check NPMRegistry
    if (this.npmRegistry) {
      try {
        const exists = await this.npmRegistry.packageExists(ghostImport);
        if (exists) {
          this.log.info('Package exists in NPM registry', { ghostImport });
          return {
            realPackage: ghostImport,
            strategy: 'npm-registry-verified'
          };
        }
      } catch (err) {
        this.log.warn('NPMRegistry check failed', {
          ghostImport,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    // Step 4: Fallback to hardcoded replacements
    const replacement = this.replacements[ghostImport];
    if (replacement) {
      this.log.info('Using hardcoded replacement', {
        ghostImport,
        realPackage: replacement
      });
      return {
        realPackage: replacement,
        strategy: 'hardcoded'
      };
    }

    this.log.warn('No replacement found for ghost import', { ghostImport });
    return null;
}
