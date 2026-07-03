/**
 * FallbackGenerator - Generates WebGL fallback code
 *
 * When WebGL is not supported, generates a CSS 2D fallback or
 * a canvas 2D fallback for the UI.
 *
 * @module validate/auto-fix/FallbackGenerator
 */

import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { join } from 'path';
import { logger } from '../../logger.js';
import type { Fix, Issue, Fixer } from '../types.js';

type UIFramework = 'react' | 'vue' | 'svelte' | 'vanilla';

interface TemplateContext {
  containerSelector: string;
  width: number;
  height: number;
  projectName: string;
}

export class FallbackGenerator implements Fixer {
  private readonly log = logger.child('FallbackGenerator');

  async fix(projectPath: string, issue: Issue): Promise<Fix> {
    this.log.info('Generating WebGL fallback', { message: issue.message });

    // 1. Detect the WebGL library and UI framework
    const webglLib = await this.detectWebGLLibrary(projectPath);
    const uiFramework = await this.detectUIFramework(projectPath);

    // 2. Get project name from package.json
    let projectName = 'project';
    try {
      const pkgPath = join(projectPath, 'package.json');
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
      projectName = pkg.name || projectName;
    } catch {
      /* package.json not found or invalid */
    }

    // 3. Create fallback utility
    const fallbackPath = join(projectPath, 'src', 'utils', 'webgl-fallback.ts');
    const fallbackDir = join(projectPath, 'src', 'utils');

    try {
      try {
        await access(fallbackDir);
      } catch {
        await mkdir(fallbackDir, { recursive: true });
      }

      // Build template context
      const context: TemplateContext = {
        containerSelector: '#app',
        width: 800,
        height: 600,
        projectName,
      };

      const fallbackCode = await this.generateFallbackCode(webglLib, context);
      await writeFile(fallbackPath, fallbackCode, 'utf-8');

      this.log.info('Created WebGL fallback utility', { path: fallbackPath });

      // 4. Add fallback CSS
      const cssPath = join(projectPath, 'src', 'styles', 'webgl-fallback.css');
      const cssDir = join(projectPath, 'src', 'styles');

      try {
        await access(cssDir);
      } catch {
        await mkdir(cssDir, { recursive: true });
      }

      const fallbackCSS = this.generateFallbackCSS();
      await writeFile(cssPath, fallbackCSS, 'utf-8');

      // 5. Integrate into entry point
      const integration = await this.integrateIntoEntryPoint(projectPath, uiFramework);

      // Build description
      let description = `Generated WebGL fallback for ${projectName} using ${webglLib ?? 'generic'} template`;
      if (integration.note) {
        description += ` (${integration.note})`;
      }

      return {
        issueType: issue.type,
        description,
        file: 'src/utils/webgl-fallback.ts',
        applied: true,
      };
    } catch (err) {
      return {
        issueType: issue.type,
        description: `Failed to generate fallback: ${err instanceof Error ? err.message : String(err)}`,
        applied: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async detectWebGLLibrary(projectPath: string): Promise<string | null> {
    try {
      const pkgPath = join(projectPath, 'package.json');
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (allDeps['three'] || allDeps['three.js']) return 'three';
      if (allDeps['babylonjs'] || allDeps['@babylonjs/core']) return 'babylon';
      if (allDeps['pixi.js'] || allDeps['@pixi/webgl']) return 'pixi';
      if (allDeps['@react-three/fiber']) return 'r3f';

      return null;
    } catch {
      return null;
    }
  }

  private async detectUIFramework(projectPath: string): Promise<UIFramework> {
    try {
      const pkgPath = join(projectPath, 'package.json');
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (allDeps['react']) return 'react';
      if (allDeps['vue']) return 'vue';
      if (allDeps['svelte']) return 'svelte';
      return 'vanilla';
    } catch {
      return 'vanilla';
    }
  }

  private async renderTemplate(
    library: string | null,
    context: TemplateContext
  ): Promise<string | null> {
    try {
      // Dynamic import for graceful degradation
      const Handlebars = await import('handlebars');

      // Determine template path
      const templatePath = join(
        new URL('../../..', import.meta.url).pathname,
        'templates',
        'fallback',
        `${library ?? 'generic'}.hbs`
      );

      // Read and compile template
      const source = await readFile(templatePath, 'utf-8');
      const template = Handlebars.default.compile(source);
      return template(context);
    } catch (err) {
      this.log.warn(
        `Failed to render template (${library ?? 'generic'}): ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  }

  private generateHardcodedFallback(library: string | null): string {
    const header = `/**
 * WebGL Fallback - Auto-generated by EscapeKit Validation Engine
 *
 * Provides fallback rendering when WebGL is not available.
 * Uses CSS transforms and canvas 2D as alternatives.
 */

`;

    if (library === 'three') {
      return (
        header +
        `
export function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch {
    return false;
  }
}

export function createThreeFallback(container: HTMLElement): void {
  container.innerHTML = \`
    <div class="webgl-fallback" data-fallback="true">
      <div class="fallback-2d-scene">
        <p>WebGL is not supported. Showing 2D fallback.</p>
        <canvas id="fallback-canvas" width="800" height="600"></canvas>
      </div>
    </div>
  \`;

  const canvas = container.querySelector('#fallback-canvas') as HTMLCanvasElement;
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#e94560';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('3D Scene (2D Fallback)', canvas.width / 2, canvas.height / 2);
    }
  }
}

export { checkWebGLSupport as default };
`
      );
    }

    // Generic fallback
    return (
      header +
      `
export function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

export function setupFallback(container: HTMLElement, options?: { width?: number; height?: number }): void {
  const width = options?.width ?? 800;
  const height = options?.height ?? 600;

  container.setAttribute('data-fallback', 'true');
  container.classList.add('webgl-fallback');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.id = 'fallback-canvas';

  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#e94560';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WebGL not supported - 2D fallback active', width / 2, height / 2);
  }
}

export { checkWebGLSupport as default };
`
    );
  }

  private async generateFallbackCode(
    library: string | null,
    context: TemplateContext
  ): Promise<string> {
    // First try to use template
    const templateResult = await this.renderTemplate(library, context);
    if (templateResult !== null) {
      return templateResult;
    }

    // Fall back to hardcoded version if template rendering fails
    this.log.warn(`Falling back to hardcoded fallback for ${library ?? 'generic'}`);
    return this.generateHardcodedFallback(library);
  }

  private async integrateIntoEntryPoint(
    projectPath: string,
    uiFramework: UIFramework
  ): Promise<{ file?: string; note?: string }> {
    const candidatesByFramework: Record<UIFramework, string[]> = {
      react: ['src/App.tsx', 'src/main.tsx', 'src/index.tsx'],
      vue: ['src/App.vue', 'src/main.ts', 'src/main.js'],
      svelte: ['src/App.svelte', 'src/main.ts', 'src/main.js'],
      vanilla: ['src/main.ts', 'src/index.ts', 'src/app.ts'],
    };

    const candidates = candidatesByFramework[uiFramework];

    for (const candidate of candidates) {
      const candidatePath = join(projectPath, candidate);

      try {
        await access(candidatePath);

        // Read file content
        let content = await readFile(candidatePath, 'utf-8');

        // Check if import already exists
        if (content.includes("from './utils/webgl-fallback'")) {
          return { file: candidate };
        }

        // Add import at the top of the file
        content = `import { checkWebGLSupport, setupFallback } from './utils/webgl-fallback';\n${content}`;
        await writeFile(candidatePath, content, 'utf-8');

        this.log.info(`Integrated fallback into entry point: ${candidate}`);
        return { file: candidate };
      } catch {
        continue;
      }
    }

    const note = `Could not find entry point to integrate fallback (tried: ${candidates.join(', ')})`;
    this.log.warn(note);
    return { note };
  }

  private generateFallbackCSS(): string {
    return `/**
 * WebGL Fallback Styles - Auto-generated by EscapeKit
 */

.webgl-fallback {
  position: relative;
  width: 100%;
  height: 100%;
  background: #1a1a2e;
  display: flex;
  align-items: center;
  justify-content: center;
}

.webgl-fallback[data-fallback="true"] {
  border: 2px dashed #e94560;
  border-radius: 8px;
}

.webgl-fallback .fallback-2d-scene {
  text-align: center;
  color: #e94560;
  font-family: sans-serif;
}

.webgl-fallback canvas {
  max-width: 100%;
  max-height: 100%;
}
`;
  }
}
