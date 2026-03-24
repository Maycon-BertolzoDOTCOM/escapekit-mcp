# Polyfill Injector Enhancements Specification

## Requirement Scenario
Enhance the `PolyfillInjector` class to automatically detect and integrate with different JavaScript bundlers (Vite, Webpack, Next.js) when injecting required polyfills.

## Technical Approach
1. Add bundler type detection capability
2. Implement bundler-specific integration methods
3. Modify existing `fix` method to use bundler detection
4. Ensure idempotent operations
5. Add comprehensive unit tests

## Affected Files
- `src/validate/auto-fix/PolyfillInjector.ts` (major modifications)
- New file: `tests/validate/PolyfillInjector.test.ts`

## Implementation Details

### Bundler Detection
```typescript
type BundlerType = 'vite' | 'webpack' | 'nextjs' | 'unknown';

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
```

### Vite Integration
```typescript
private async integrateVite(projectPath: string): Promise<{ file: string | undefined; note?: string }> {
  const entryPoints = ['src/main.ts', 'src/main.tsx', 'src/index.ts', 'src/index.tsx'];
  
  for (const entry of entryPoints) {
    if (await this.hasFile(projectPath, entry)) {
      const content = await fs.readFile(path.join(projectPath, entry), 'utf8');
      if (!content.includes('import './polyfills'')) {
        await fs.writeFile(path.join(projectPath, entry), `import './polyfills';\n${content}`);
        return { file: entry };
      }
      return { file: entry, note: 'Polyfill import already exists' };
    }
  }
  
  return { file: undefined, note: 'No Vite entry point found' };
}
```

### Webpack Integration
```typescript
private async integrateWebpack(projectPath: string): Promise<{ file: string }> {
  const configFiles = ['webpack.config.js', 'webpack.config.ts'];
  
  for (const configFile of configFiles) {
    if (await this.hasFile(projectPath, configFile)) {
      let content = await fs.readFile(path.join(projectPath, configFile), 'utf8');
      
      // Skip if already modified
      if (content.includes("'./src/polyfills'")) {
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
      
      await fs.writeFile(path.join(projectPath, configFile), content);
      return { file: configFile };
    }
  }
  
  throw new Error('No Webpack configuration file found');
}
```

## Boundary Conditions
- Handle cases where multiple bundler indicators exist
- Ensure idempotent operations (don't duplicate imports)
- Gracefully handle missing configuration files
- Maintain existing behavior for unknown issues/unmapped polyfills

## Expected Outcomes
- Automatic bundler detection with priority: Next.js > Vite > Webpack
- Correct polyfill injection for each bundler type
- Warning when bundler cannot be detected
- Comprehensive test coverage for all scenarios