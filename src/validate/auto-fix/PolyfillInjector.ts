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

type BundlerType = 'vite' | 'webpack' | 'nextjs' | 'unknown';

export class PolyfillInjector implements Fixer {
  private async hasFile(projectPath: string, fileName: string): Promise<boolean> {
    try {
      await access(join(projectPath, fileName));
      return true;
    } catch {
      return false;
    }
  }

  private async hasDirectory(projectPath: string, dirName: string): Promise<boolean> {
    try {
      await access(join(projectPath, dirName));
      return true;
    } catch {
      return false;
    }
  }

  private async detectBundler(projectPath: string): Promise<BundlerType> {
    // Check for Next.js indicators first (highest priority)
    const [hasNextConfig, hasPagesDir, hasAppDir] = await Promise.all([
      this.hasFile(projectPath, 'next.config.{js,ts}'),
      this.hasDirectory(projectPath, 'pages'),
      this.hasDirectory(projectPath, 'app')
    ]);
    
    if (hasNextConfig || hasPagesDir || hasAppDir) return 'nextjs';
    
    // Check for Vite
    if (await this.hasFile(projectPath, 'vite.config.{js,ts}')) return 'vite';
    
    // Check for Webpack
    if (await this.hasFile(projectPath, 'webpack.config.{js,ts}')) return 'webpack';
    
    return 'unknown';
  }
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

    // 3. Detect bundler and integrate
    try {
      const bundler = await this.detectBundler(projectPath);
      
      if (bundler === 'unknown') {
        this.log.warn('Could not detect bundler - manual integration required');
        return {
          issueType: issue.type,
          description: `Injected polyfill for '${apiName}' but bundler was not detected`,
          file: 'src/polyfills.ts',
          applied: true,
          note: 'Manual bundler integration required'
        };
      }
      
      let integrationResult;
      switch (bundler) {
        case 'vite':
          integrationResult = await this.integrateVite(projectPath);
          break;
        case 'webpack':
          integrationResult = await this.integrateWebpack(projectPath);
          break;
        case 'nextjs':
          integrationResult = await this.integrateNextjs(projectPath);
          break;
      }
      
      return {
        issueType: issue.type,
        description: `Injected polyfill for '${apiName}' and integrated with ${bundler}`,
        file: integrationResult.file || 'src/polyfills.ts',
        applied: true,
        note: integrationResult.note
      };
    } catch (error) {
      this.log.warn('Bundler integration failed', { error });
      return {
        issueType: issue.type,
        description: `Injected polyfill for '${apiName}' but bundler integration failed`,
        file: 'src/polyfills.ts',
        applied: true,
        note: error instanceof Error ? error.message : 'Bundler integration failed'
      };
    }
}

private async integrateVite(projectPath: string): Promise<{ file: string | undefined; note?: string }> {
  const entryPoints = ['src/main.ts', 'src/main.tsx', 'src/index.ts', 'src/index.tsx'];
  
  for (const entry of entryPoints) {
    const entryPath = join(projectPath, entry);
    if (await this.hasFile(projectPath, entry)) {
      const content = await readFile(entryPath, 'utf8');
      if (!content.includes('import \'./polyfills\'') && !content.includes('import "./polyfills"')) {
        await writeFile(entryPath, `import './polyfills';\n${content}`);
        return { file: entry };
      }
      return { file: entry, note: 'Polyfill import already exists' };
    }
  }
  
  return { file: undefined, note: 'No Vite entry point found' };
}

private async integrateWebpack(projectPath: string): Promise<{ file: string }> {
  const configFiles = ['webpack.config.js', 'webpack.config.ts'];
  
  for (const configFile of configFiles) {
    const configPath = join(projectPath, configFile);
    if (await this.hasFile(projectPath, configFile)) {
      let content = await readFile(configPath, 'utf8');
      
      // Skip if already modified
      if (content.includes("'./src/polyfills'") || content.includes('"./src/polyfills"')) {
        return { file: configFile };
      }
      
      // Transform string entry
      content = content.replace(
        /entry:\s*['"]([^'"]+)['"]/g,
        "entry: ['$1', './src/polyfills']"
      );
      
      // Transform array entry
      content = content.replace(
        /entry:\s*\[([^\]]+)\]/g,
        "entry: [$1, './src/polyfills']"
      );
      
      await writeFile(configPath, content);
      return { file: configFile };
    }
  }
  
  throw new Error('No Webpack configuration file found');
}

private async integrateNextjs(projectPath: string): Promise<{ file: string; note?: string }> {
  let result: { file: string; note?: string } = { file: '', note: undefined };
  
  // Handle Pages Router (_app.tsx)
  const pagesAppPath = join(projectPath, 'pages', '_app.tsx');
  if (await this.hasFile(projectPath, 'pages/_app.tsx')) {
    const content = await readFile(pagesAppPath, 'utf8');
    if (!content.includes('import \'../polyfills\'') && !content.includes('import "../polyfills"')) {
      await writeFile(pagesAppPath, `import '../polyfills';\n${content}`);
      result.file = 'pages/_app.tsx';
    } else {
      result.note = 'Polyfill import already exists in _app.tsx';
    }
  }
  
  // Handle App Router (layout.tsx)
  const appLayoutPath = join(projectPath, 'app', 'layout.tsx');
  if (await this.hasFile(projectPath, 'app/layout.tsx')) {
    const content = await readFile(appLayoutPath, 'utf8');
    if (!content.includes('import \'../../polyfills\'') && !content.includes('import "../../polyfills"')) {
      await writeFile(appLayoutPath, `import '../../polyfills';\n${content}`);
      result.file = result.file ? `${result.file}, app/layout.tsx` : 'app/layout.tsx';
    } else if (!result.note) {
      result.note = 'Polyfill import already exists in layout.tsx';
    }
  } else if (await this.hasDirectory(projectPath, 'app')) {
    result.note = result.note 
      ? `${result.note}; No layout.tsx found in app directory` 
      : 'No layout.tsx found in app directory';
  }
  
  // If neither exists but we have pages directory, create minimal _app.tsx
  if (!result.file && await this.hasDirectory(projectPath, 'pages')) {
    const minimalApp = `import '../polyfills';
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
`;
    await writeFile(pagesAppPath, minimalApp);
    result.file = 'pages/_app.tsx';
    result.note = 'Created minimal _app.tsx with polyfill import';
  }
  
  if (!result.file) {
    throw new Error('No Next.js entry point found');
  }
  
  return result;
}
}
