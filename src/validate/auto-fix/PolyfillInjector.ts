/**
 * PolyfillInjector - Injects necessary polyfills for missing APIs
 *
 * Detects missing browser/Node polyfills and adds them to the project.
 *
 * @module validate/auto-fix/PolyfillInjector
 */

import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { logger } from '../../logger.js';
import type { Fix, Issue, Fixer } from '../types.js';

export class PolyfillInjector implements Fixer {
  private readonly log = logger.child('PolyfillInjector');

  private readonly polyfillMap: Record<string, { package: string; importStatement: string }> = {
    IntersectionObserver: {
      package: 'intersection-observer',
      importStatement: "import 'intersection-observer';",
    },
    ResizeObserver: {
      package: '@juggle/resize-observer',
      importStatement: "import { ResizeObserver } from '@juggle/resize-observer';",
    },
    structuredClone: {
      package: 'core-js',
      importStatement: "import 'core-js/features/structured-clone';",
    },
    fetch: { package: 'node-fetch', importStatement: "import fetch from 'node-fetch';" },
    URL: { package: 'whatwg-url', importStatement: "import { URL } from 'whatwg-url';" },
    crypto: {
      package: 'crypto-browserify',
      importStatement: "import crypto from 'crypto-browserify';",
    },
    AbortController: {
      package: 'abort-controller',
      importStatement: "import AbortController from 'abort-controller';",
    },
    TextEncoder: {
      package: 'text-encoding',
      importStatement: "import { TextEncoder, TextDecoder } from 'text-encoding';",
    },
  };

  async fix(projectPath: string, issue: Issue): Promise<Fix> {
    this.log.info('Attempting polyfill injection', { message: issue.message });

    // Parse the message to find the missing API
    const apiMatch =
      issue.message.match(/(\w+) is not (defined|available|supported)/i) ||
      issue.message.match(/Cannot find (?:module|name) ['"](\w+)['"]/);

    if (!apiMatch) {
      return {
        issueType: issue.type,
        description: 'Could not determine which polyfill is needed',
        applied: false,
        error: 'Unknown polyfill requirement',
      };
    }

    const apiName = apiMatch[1];
    const polyfill = this.polyfillMap[apiName];

    if (!polyfill) {
      return {
        issueType: issue.type,
        description: `No known polyfill for '${apiName}'`,
        applied: false,
        error: `Unknown API: ${apiName}`,
      };
    }

    // 1. Add package to package.json
    const packageJsonPath = join(projectPath, 'package.json');
    try {
      const pkgContent = await readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);

      if (!pkg.dependencies) pkg.dependencies = {};
      if (!pkg.dependencies[polyfill.package]) {
        pkg.dependencies[polyfill.package] = 'latest';
        await writeFile(packageJsonPath, JSON.stringify(pkg, null, 2), 'utf-8');
        this.log.info('Added polyfill package to package.json', { package: polyfill.package });
      }
    } catch (err) {
      return {
        issueType: issue.type,
        description: `Failed to update package.json: ${err instanceof Error ? err.message : String(err)}`,
        applied: false,
        error: 'Could not update package.json',
      };
    }

    // 2. Create a polyfills.ts entry file if it doesn't exist
    const polyfillsPath = join(projectPath, 'src', 'polyfills.ts');
    try {
      await access(polyfillsPath);
      // File exists - append
      const existing = await readFile(polyfillsPath, 'utf-8');
      if (!existing.includes(polyfill.importStatement)) {
        await writeFile(polyfillsPath, `${existing}\n${polyfill.importStatement}`, 'utf-8');
      }
    } catch {
      // File doesn't exist - create
      const { mkdir } = await import('fs/promises');
      const srcDir = join(projectPath, 'src');
      try {
        await access(srcDir);
      } catch {
        await mkdir(srcDir, { recursive: true });
      }
      await writeFile(
        polyfillsPath,
        `// Auto-generated polyfills\n${polyfill.importStatement}\n`,
        'utf-8'
      );
    }

    return {
      issueType: issue.type,
      description: `Injected polyfill for '${apiName}' using '${polyfill.package}'`,
      file: 'src/polyfills.ts',
      applied: true,
    };
  }
}
