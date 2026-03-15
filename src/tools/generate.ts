/**
 * Generate tool for MCP server
 *
 * Implements generate_escape_kit: resolves ghost imports, transforms code,
 * generates project scaffolding, and writes an escape contract.
 */

import { join } from 'path';
import {
  generateId,
  createSuccessResponse,
  createErrorResponse,
  type AnalysisResult,
  type EscapeKit,
} from '../models/schemas.js';
import { DependencyResolver } from '../resolvers/DependencyResolver.js';
import { KnowledgeBase } from '../resolvers/KnowledgeBase.js';
import { SemanticMatcher } from '../resolvers/SemanticMatcher.js';
import { NPMRegistry } from '../services/NPMRegistry.js';
import { ImportReplacer } from '../transformers/ImportReplacer.js';
import { ProjectGenerator } from '../generators/ProjectGenerator.js';
import { EscapeContractWriter } from '../generators/EscapeContractWriter.js';
import { TransformationPipeline } from '../generators/TransformationPipeline.js';
import { logger } from '../logger.js';
import type { DependencyResolution, CodeTransformation } from '../models/transformation.js';
import { ResolutionMethod } from '../models/transformation.js';

const log = logger.child('generate');

/** Options for escape kit generation */
export interface GenerateOptions {
  /** Include Dockerfile */
  includeDocker?: boolean;
  /** Include CI/CD workflow */
  includeCI?: boolean;
  /** Custom template directory */
  templatePath?: string;
  /** Force processing of non-autoFixable issues */
  force?: boolean;
  /** Dry run - plan without writing files */
  dryRun?: boolean;
}

/**
 * Generate an escape kit from an AnalysisResult.
 *
 * Full pipeline:
 *   AnalysisResult → ghost import extraction → dependency resolution
 *   → import replacement → project scaffolding → escape contract
 *
 * @param analysisResult - Phase 2 analysis result
 * @param sourceCode - Original source code to transform
 * @param targetPlatform - Deployment target (vercel, netlify, docker, local)
 * @param outputDir - Output directory for generated project
 * @param options - Additional generation options
 */
export async function generateEscapeKit(
  analysisResult: AnalysisResult,
  sourceCode: string,
  targetPlatform = 'local',
  outputDir = './escape_output',
  options: GenerateOptions = {}
) {
  const { includeDocker = false, includeCI = false, force = false, dryRun = false } = options;

  log.info('Starting escape kit generation', {
    analysisId: analysisResult.analysisId,
    targetPlatform,
    outputDir,
    dryRun,
  });

  try {
    // ── Step 1: Extract ghost imports via TransformationPipeline ──────────────
    const pipeline = new TransformationPipeline();
    const pipelineResult = await pipeline.processAnalysisResult(analysisResult, sourceCode, {
      force,
      targetPlatform,
      outputDir,
      includeDocker,
      includeCI,
    });

    if (pipelineResult.warnings.length > 0) {
      pipelineResult.warnings.forEach((w) => log.warn(w));
    }

    // ── Step 2: Resolve ghost imports ─────────────────────────────────────────
    const npmRegistry = new NPMRegistry();
    const knowledgeBase = new KnowledgeBase();
    const semanticMatcher = new SemanticMatcher(npmRegistry);
    const resolver = new DependencyResolver(npmRegistry, knowledgeBase, semanticMatcher);

    const resolutions: DependencyResolution[] = [];
    const dependencies = new Map<string, string>();

    for (const issue of pipelineResult.ghostImports) {
      // Extract package name from issue message (e.g. "Ghost import: 'fake-api'")
      const packageName = extractPackageName(issue.message) ?? issue.message;
      try {
        const resolution = await resolver.resolve(packageName);
        resolutions.push(resolution);
        dependencies.set(resolution.resolvedPackage, resolution.version);
        log.info(`Resolved: ${packageName} → ${resolution.resolvedPackage}@${resolution.version}`);
      } catch (err) {
        log.warn(`Could not resolve "${packageName}": ${(err as Error).message}`);
        // Add as unresolved with low confidence
        resolutions.push({
          originalImport: packageName,
          resolvedPackage: packageName,
          version: 'latest',
          resolutionMethod: ResolutionMethod.KNOWLEDGE_BASE,
          confidence: 0.0,
          metadata: { validationStatus: 'UNVERIFIED' },
        } as DependencyResolution);
      }
    }

    // ── Step 3: Transform source code ─────────────────────────────────────────
    const transformations: CodeTransformation[] = [];
    let transformedCode = sourceCode;

    const actionableResolutions = resolutions.filter((r) => r.confidence > 0);

    if (actionableResolutions.length > 0 && sourceCode.trim()) {
      try {
        const replacer = new ImportReplacer();
        // replaceImports returns a CodeTransformation (not a string)
        const transformation = replacer.replaceImports(sourceCode, actionableResolutions);
        transformedCode = transformation.transformedCode;
        transformations.push(transformation);
      } catch (err) {
        log.warn(`Code transformation failed: ${(err as Error).message}`);
        // Continue with original code
      }
    }

    // ── Step 4: Generate escape contract ──────────────────────────────────────
    const contractWriter = new EscapeContractWriter();
    const contract = contractWriter.generate({
      analysisResult,
      resolutions,
      transformations,
      originalCode: sourceCode,
      targetPlatform,
      toolVersion: '1.0.0',
    });

    // ── Step 5: Generate project scaffolding ──────────────────────────────────
    const escapeId = generateId('escape');
    const projectPath = join(outputDir, escapeId);
    const filesCreated: string[] = [];

    if (!dryRun) {
      const generator = new ProjectGenerator();
      const projectName = `escape-kit-${analysisResult.analysisId.slice(-8)}`;

      const structure = await generator.generate({
        rootPath: projectPath,
        projectName,
        description: `EscapeKit generated project from analysis ${analysisResult.analysisId}`,
        targetPlatform,
        dependencies,
        escapeContract: contract,
        includeDocker,
        includeCI,
      });

      // Write transformed source if we have it
      if (transformedCode !== sourceCode && transformedCode.trim()) {
        const { writeFile, mkdir } = await import('fs/promises');
        const srcFile = join(projectPath, 'src', 'index.ts');
        await mkdir(join(projectPath, 'src'), { recursive: true });
        await writeFile(srcFile, transformedCode, 'utf-8');
        structure.files.set('src/index.ts', transformedCode);
      }

      // Write escape contract
      const contractPath = join(projectPath, 'escape-contract.json');
      await contractWriter.writeToFile(contract, contractPath);

      filesCreated.push(...Array.from(structure.files.keys()), 'escape-contract.json');
    }

    log.info('Escape kit generation complete', {
      escapeId,
      ghostImportsResolved: resolutions.filter((r) => r.confidence > 0).length,
      filesCreated: filesCreated.length,
    });

    return createSuccessResponse<EscapeKit>({
      escapeId,
      analysisId: analysisResult.analysisId,
      outputPath: dryRun ? outputDir : projectPath,
      targetPlatform,
      filesCreated,
      escapeContractPath: dryRun ? '' : join(projectPath, 'escape-contract.json'),
      summary: {
        ghostImportsResolved: resolutions.filter((r) => r.confidence > 0).length,
        polyfillsAdded: 0,
        dependenciesInstalled: dependencies.size,
      },
    });
  } catch (error) {
    log.error('Escape kit generation failed', { error });
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error during generation',
      'GENERATION_ERROR'
    );
  }
}

/**
 * Legacy wrapper kept for backward compatibility with server.ts stub.
 * Accepts raw parameters as the server currently passes them.
 */
export async function generateEscape(
  analysisId: string,
  targetPlatform = 'nextjs',
  outputDir = './escape_output'
) {
  if (!analysisId) {
    return createErrorResponse('analysis_id parameter is required', 'MISSING_PARAMETER');
  }

  // Without a stored AnalysisResult we can only return a stub
  const escapeId = generateId('escape');
  return createSuccessResponse<EscapeKit>({
    escapeId,
    analysisId,
    outputPath: outputDir,
    targetPlatform,
    filesCreated: [],
    escapeContractPath: `${outputDir}/escape-contract.json`,
    summary: {
      ghostImportsResolved: 0,
      polyfillsAdded: 0,
      dependenciesInstalled: 0,
    },
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract package name from an issue message like "Ghost import: 'fake-api'" */
function extractPackageName(message: string): string | null {
  const match = message.match(/['"`]([^'"`]+)['"`]/);
  return match ? match[1] : null;
}
