/**
 * AutoFixEngine - Orchestrates automatic fixes for detected issues
 *
 * Routes issues to the appropriate Fixer implementation and
 * collects the results of applied fixes.
 *
 * @module validate/auto-fix/AutoFixEngine
 */

import { logger } from '../../logger.js';
import type { Issue, IssueType, Fix, Fixer } from '../types.js';
import { MockReplacer } from './MockReplacer.js';
import { PolyfillInjector } from './PolyfillInjector.js';
import { FallbackGenerator } from './FallbackGenerator.js';
import { ConfigUpdater } from './ConfigUpdater.js';

export class AutoFixEngine {
  private readonly log = logger.child('AutoFixEngine');
  private readonly fixers: Map<IssueType, Fixer>;

  constructor() {
    this.fixers = new Map();
    this.fixers.set('GHOST_IMPORT', new MockReplacer());
    this.fixers.set('MISSING_POLYFILL', new PolyfillInjector());
    this.fixers.set('WEBGL_UNSUPPORTED', new FallbackGenerator());
    this.fixers.set('OUTDATED_CONFIG', new ConfigUpdater());
    this.fixers.set('MISSING_DEPENDENCY', new MockReplacer());
  }

  async fix(projectPath: string, issues: Issue[]): Promise<Fix[]> {
    this.log.info('Starting auto-fix', { projectPath, issueCount: issues.length });

    const fixes: Fix[] = [];

    for (const issue of issues) {
      const fixer = this.fixers.get(issue.type);
      if (!fixer) {
        this.log.debug('No fixer for issue type', { type: issue.type });
        continue;
      }

      try {
        const fix = await fixer.fix(projectPath, issue);
        fixes.push(fix);
        this.log.info('Fix applied', { type: issue.type, applied: fix.applied, file: fix.file });
      } catch (err) {
        fixes.push({
          issueType: issue.type,
          description: `Failed to fix: ${err instanceof Error ? err.message : String(err)}`,
          file: issue.file,
          applied: false,
          error: err instanceof Error ? err.message : String(err),
        });
        this.log.error('Fix failed', { type: issue.type, error: err });
      }
    }

    const applied = fixes.filter(f => f.applied).length;
    this.log.info('Auto-fix complete', { total: fixes.length, applied });

    return fixes;
  }

  canFix(issueType: IssueType): boolean {
    return this.fixers.has(issueType);
  }

  getSupportedTypes(): IssueType[] {
    return Array.from(this.fixers.keys());
  }
}
