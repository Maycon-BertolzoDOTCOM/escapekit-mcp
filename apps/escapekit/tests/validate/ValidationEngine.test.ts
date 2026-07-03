import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { ValidationEngine } from '../../src/validate/ValidationEngine.js';
import { BuildValidator } from '../../src/validate/validators/BuildValidator.js';
import { DependencyValidator } from '../../src/validate/validators/DependencyValidator.js';
import { AutoFixEngine } from '../../src/validate/auto-fix/AutoFixEngine.js';
import { MockReplacer } from '../../src/validate/auto-fix/MockReplacer.js';
import { ConfigUpdater } from '../../src/validate/auto-fix/ConfigUpdater.js';

const FIXTURE_DIR = join(__dirname, '../fixtures/validation-unit-test');

describe('ValidationEngine', () => {
  beforeAll(async () => {
    await mkdir(join(FIXTURE_DIR, 'src'), { recursive: true });
    await writeFile(
      join(FIXTURE_DIR, 'package.json'),
      JSON.stringify({
        name: 'unit-test-project',
        type: 'module',
        dependencies: { lodash: '^4.0.0' },
        devDependencies: {},
      })
    );
    await writeFile(
      join(FIXTURE_DIR, 'src/index.ts'),
      "import _ from 'lodash';\nconsole.log(_);\n"
    );
  });

  afterAll(async () => {
    await rm(FIXTURE_DIR, { recursive: true, force: true });
  });

  describe('validate()', () => {
    it('should return canDeploy=false for non-existent path', async () => {
      const engine = new ValidationEngine();
      const result = await engine.validate('/tmp/non-existent-path-xyz', {
        level: 'basic',
        timeout: 10000,
      });
      expect(result.canDeploy).toBe(false);
      expect(result.checks.build.passed).toBe(false);
    });

    it('should pass basic validation for clean project', async () => {
      const engine = new ValidationEngine();
      const result = await engine.validate(FIXTURE_DIR, {
        level: 'basic',
        timeout: 60000,
      });
      expect(result.checks.build.passed).toBe(true);
      expect(result.checks.dependencies.passed).toBe(true);
      expect(result.checks.dependencies.ghostPackages).toHaveLength(0);
      expect(result.confidence).toBeGreaterThan(0.8);
    }, 60000);

    it('should calculate confidence from all check results', async () => {
      const engine = new ValidationEngine();
      const result = await engine.validate(FIXTURE_DIR, {
        level: 'basic',
        timeout: 60000,
      });
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }, 60000);

    it('should report duration', async () => {
      const engine = new ValidationEngine();
      const result = await engine.validate(FIXTURE_DIR, {
        level: 'basic',
        timeout: 60000,
      });
      expect(result.duration).toBeGreaterThan(0);
    }, 60000);
  });

  describe('canFix()', () => {
    it('should return true for supported issue types', () => {
      const engine = new ValidationEngine();
      expect(engine.canFix('GHOST_IMPORT')).toBe(true);
      expect(engine.canFix('MISSING_POLYFILL')).toBe(true);
      expect(engine.canFix('WEBGL_UNSUPPORTED')).toBe(true);
      expect(engine.canFix('OUTDATED_CONFIG')).toBe(true);
    });

    it('should return false for unsupported issue types', () => {
      const engine = new ValidationEngine();
      expect(engine.canFix('UNKNOWN_TYPE' as any)).toBe(false);
    });
  });
});

describe('BuildValidator', () => {
  it('should return errors for missing package.json', async () => {
    const validator = new BuildValidator();
    const result = await validator.validate('/tmp/non-existent-path-xyz');
    expect(result.passed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain('package.json');
  });

  it('should measure installTime and buildTime', async () => {
    const validator = new BuildValidator({ installTimeoutMs: 15000, buildTimeoutMs: 15000 });
    const result = await validator.validate(FIXTURE_DIR);
    expect(result.installTime).toBeGreaterThanOrEqual(0);
    expect(result.buildTime).toBeGreaterThanOrEqual(0);
  });
});

describe('DependencyValidator', () => {
  const GHOST_FIXTURE = join(FIXTURE_DIR, 'ghost-test');

  beforeAll(async () => {
    await mkdir(join(GHOST_FIXTURE, 'src'), { recursive: true });
    await writeFile(
      join(GHOST_FIXTURE, 'package.json'),
      JSON.stringify({
        name: 'ghost-test',
        dependencies: { react: '^18.0.0' },
        devDependencies: {},
      })
    );
    await writeFile(
      join(GHOST_FIXTURE, 'src/app.ts'),
      "import React from 'react';\nimport api from 'fake-api';\nimport db from 'sandbox-database';\n"
    );
  });

  afterAll(async () => {
    await rm(GHOST_FIXTURE, { recursive: true, force: true });
  });

  it('should detect ghost packages matching patterns', async () => {
    const validator = new DependencyValidator();
    const result = await validator.checkGhostPackages(GHOST_FIXTURE);
    const ghostNames = result.map(g => g.name);
    expect(ghostNames).toContain('fake-api');
    expect(ghostNames).toContain('sandbox-database');
  });

  it('should return empty ghosts for clean project', async () => {
    const validator = new DependencyValidator();
    const result = await validator.checkGhostPackages(FIXTURE_DIR);
    expect(result).toHaveLength(0);
  });
});

describe('AutoFixEngine', () => {
  const FIXTURE = join(FIXTURE_DIR, 'autofix-test');

  beforeAll(async () => {
    await mkdir(join(FIXTURE, 'src'), { recursive: true });
    await writeFile(
      join(FIXTURE, 'package.json'),
      JSON.stringify({
        name: 'autofix-test',
        dependencies: { 'fake-api': '^1.0.0', lodash: '^4.0.0' },
        devDependencies: {},
      })
    );
    await writeFile(
      join(FIXTURE, 'src/app.ts'),
      "import api from 'fake-api';\nconsole.log(api);\n"
    );
  });

  afterAll(async () => {
    await rm(FIXTURE, { recursive: true, force: true });
  });

  it('should fix GHOST_IMPORT via MockReplacer', async () => {
    const engine = new AutoFixEngine();
    const fixes = await engine.fix(FIXTURE, [
      {
        type: 'GHOST_IMPORT',
        severity: 'error',
        message: 'Ghost import detected: "fake-api" in src/app.ts',
        file: 'src/app.ts',
      },
    ]);
    expect(fixes).toHaveLength(1);
    expect(fixes[0].applied).toBe(true);
    expect(fixes[0].description).toContain('axios');
  });

  it('should report canFix for supported types', () => {
    const engine = new AutoFixEngine();
    expect(engine.canFix('GHOST_IMPORT')).toBe(true);
    expect(engine.canFix('MISSING_POLYFILL')).toBe(true);
  });

  it('should return failure for unknown issue types', () => {
    const engine = new AutoFixEngine();
    expect(engine.canFix('UNKNOWN_TYPE' as any)).toBe(false);
  });
});

describe('MockReplacer', () => {
  const FIXTURE = join(FIXTURE_DIR, 'mock-test');

  beforeAll(async () => {
    await mkdir(join(FIXTURE, 'src'), { recursive: true });
    await writeFile(
      join(FIXTURE, 'package.json'),
      JSON.stringify({
        name: 'mock-test',
        dependencies: { 'fake-api': '^1.0.0', 'claude-sdk': '^1.0.0' },
        devDependencies: {},
      })
    );
    await writeFile(
      join(FIXTURE, 'src/app.ts'),
      "import api from 'fake-api';\nimport claude from 'claude-sdk';\n"
    );
  });

  afterAll(async () => {
    await rm(FIXTURE, { recursive: true, force: true });
  });

  it('should replace fake-api with axios', async () => {
    const replacer = new MockReplacer();
    const fix = await replacer.fix(FIXTURE, {
      type: 'GHOST_IMPORT',
      severity: 'error',
      message: 'Ghost import detected: "fake-api" in src/app.ts',
      file: 'src/app.ts',
    });
    expect(fix.applied).toBe(true);
    expect(fix.description).toContain('axios');
  });

  it('should replace claude-sdk with @anthropic-ai/sdk', async () => {
    const replacer = new MockReplacer();
    const fix = await replacer.fix(FIXTURE, {
      type: 'GHOST_IMPORT',
      severity: 'error',
      message: 'Ghost import detected: "claude-sdk" in src/app.ts',
      file: 'src/app.ts',
    });
    expect(fix.applied).toBe(true);
    expect(fix.description).toContain('@anthropic-ai/sdk');
  });

  it('should also update package.json', async () => {
    const { readFile } = await import('fs/promises');
    const pkg = JSON.parse(await readFile(join(FIXTURE, 'package.json'), 'utf-8'));
    // After the fake-api fix above, package.json should have axios
    expect(pkg.dependencies['axios']).toBeDefined();
    expect(pkg.dependencies['fake-api']).toBeUndefined();
  });

  it('should not modify file when no match found', async () => {
    const replacer = new MockReplacer();
    const fix = await replacer.fix(FIXTURE, {
      type: 'GHOST_IMPORT',
      severity: 'error',
      message: 'Ghost import detected: "unknown-ghost-pkg" in src/app.ts',
      file: 'src/app.ts',
    });
    expect(fix.applied).toBe(false);
  });
});

describe('ConfigUpdater', () => {
  const FIXTURE = join(FIXTURE_DIR, 'config-test');

  beforeAll(async () => {
    await mkdir(FIXTURE, { recursive: true });
    await writeFile(join(FIXTURE, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }));
  });

  afterAll(async () => {
    await rm(FIXTURE, { recursive: true, force: true });
  });

  it('should add missing fields to tsconfig.json', async () => {
    const updater = new ConfigUpdater();
    const fix = await updater.fix(FIXTURE, {
      type: 'OUTDATED_CONFIG',
      severity: 'warning',
      message: 'tsconfig.json missing moduleResolution',
      file: 'tsconfig.json',
    });
    expect(fix.applied).toBe(true);

    const { readFile } = await import('fs/promises');
    const tsconfig = JSON.parse(await readFile(join(FIXTURE, 'tsconfig.json'), 'utf-8'));
    expect(tsconfig.compilerOptions.module).toBe('ESNext');
    expect(tsconfig.compilerOptions.moduleResolution).toBe('bundler');
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });
});
