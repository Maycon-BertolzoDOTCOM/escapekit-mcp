/**
 * EscapeContractWriter - Generates, serializes, and validates escape contracts.
 *
 * Escape contracts are JSON documents that record all transformations applied
 * to sandbox code, providing a complete audit trail.
 *
 * @module generators/EscapeContractWriter
 */

import { createHash } from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import { generateId } from '../models/schemas.js';
import type { AnalysisResult } from '../models/schemas.js';
import type {
  EscapeContract,
  DependencyResolution,
  CodeTransformation,
} from '../models/transformation.js';
import { FileSystemError } from '../errors.js';

/** Parameters for generating an escape contract */
export interface EscapeContractParams {
  analysisResult: AnalysisResult;
  resolutions: DependencyResolution[];
  transformations: CodeTransformation[];
  originalCode?: string;
  targetPlatform?: string;
  toolVersion?: string;
}

/**
 * Generates, writes, reads, and validates EscapeContract documents.
 *
 * Contracts are stored as JSON (human-readable, no external YAML dependency).
 *
 * @example
 * ```typescript
 * const writer = new EscapeContractWriter();
 * const contract = writer.generate({ analysisResult, resolutions, transformations });
 * await writer.writeToFile(contract, '/output/escape-contract.json');
 * const loaded = await writer.parseFromFile('/output/escape-contract.json');
 * ```
 */
export class EscapeContractWriter {
  /**
   * Generate an EscapeContract from transformation data.
   *
   * @param params - Input data for contract generation
   * @returns A fully populated EscapeContract
   */
  generate(params: EscapeContractParams): EscapeContract {
    const {
      analysisResult,
      resolutions,
      transformations,
      originalCode = '',
      targetPlatform = 'local',
      toolVersion = '1.0.0',
    } = params;

    // Collect all applied rules from transformations
    const appliedRules = transformations.flatMap((t) => t.appliedRules);

    // Build assumptions from unresolved or low-confidence resolutions
    const assumptions: string[] = [];
    for (const res of resolutions) {
      if (res.confidence < 0.7) {
        assumptions.push(
          `Low-confidence resolution: "${res.originalImport}" → "${res.resolvedPackage}" (confidence: ${res.confidence.toFixed(2)})`
        );
      }
      if (res.metadata?.validationStatus === 'UNVERIFIED') {
        assumptions.push(
          `Package "${res.resolvedPackage}" could not be verified against npm registry`
        );
      }
    }

    return {
      contractId: generateId('contract'),
      analysisId: analysisResult.analysisId,
      origin: {
        sandboxType: analysisResult.sandboxType,
        originalCodeHash: originalCode ? this.calculateCodeHash(originalCode) : '',
        detectedIssues: analysisResult.summary.totalIssues,
      },
      transformations: {
        ghostImportResolutions: resolutions,
        codeTransformations: transformations,
        appliedRules,
      },
      assumptions,
      validationStatus: 'PENDING',
      metadata: {
        generatedBy: 'EscapeKit MCP',
        toolVersion,
        targetPlatform,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Serialize an EscapeContract to JSON and write it to a file.
   *
   * @param contract - The contract to write
   * @param path - Destination file path
   * @throws FileSystemError if the write fails
   */
  async writeToFile(contract: EscapeContract, path: string): Promise<void> {
    const json = JSON.stringify(contract, this.replacer, 2);
    try {
      await writeFile(path, json, 'utf-8');
    } catch (err) {
      throw new FileSystemError(
        `Failed to write escape contract to "${path}": ${(err as Error).message}`,
        'writeFile',
        { path }
      );
    }
  }

  /**
   * Read and parse an EscapeContract from a JSON file.
   *
   * @param path - Source file path
   * @returns Parsed EscapeContract
   * @throws FileSystemError if the file cannot be read
   * @throws Error if the JSON is invalid or required fields are missing
   */
  async parseFromFile(path: string): Promise<EscapeContract> {
    let raw: string;
    try {
      raw = await readFile(path, 'utf-8');
    } catch (err) {
      throw new FileSystemError(
        `Failed to read escape contract from "${path}": ${(err as Error).message}`,
        'readFile',
        { path }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw, this.reviver);
    } catch (err) {
      throw new Error(`Invalid JSON in escape contract "${path}": ${(err as Error).message}`);
    }

    const contract = parsed as EscapeContract;
    const valid = this.validate(contract);
    if (!valid) {
      throw new Error(`Escape contract at "${path}" is missing required fields`);
    }

    return contract;
  }

  /**
   * Validate that an EscapeContract has all required fields.
   *
   * @param contract - Contract to validate
   * @returns true if valid, false otherwise
   */
  validate(contract: unknown): boolean {
    if (!contract || typeof contract !== 'object') return false;
    const c = contract as Record<string, unknown>;

    // Required top-level fields
    if (typeof c['contractId'] !== 'string' || !c['contractId']) return false;
    if (typeof c['analysisId'] !== 'string' || !c['analysisId']) return false;
    if (!c['origin'] || typeof c['origin'] !== 'object') return false;
    if (!c['transformations'] || typeof c['transformations'] !== 'object') return false;
    if (!Array.isArray(c['assumptions'])) return false;
    if (typeof c['validationStatus'] !== 'string') return false;
    if (!c['metadata'] || typeof c['metadata'] !== 'object') return false;

    // Required origin fields
    const origin = c['origin'] as Record<string, unknown>;
    if (typeof origin['originalCodeHash'] !== 'string') return false;
    if (typeof origin['detectedIssues'] !== 'number') return false;

    // Required metadata fields
    const meta = c['metadata'] as Record<string, unknown>;
    if (typeof meta['generatedBy'] !== 'string') return false;
    if (typeof meta['toolVersion'] !== 'string') return false;
    if (typeof meta['targetPlatform'] !== 'string') return false;
    if (typeof meta['timestamp'] !== 'string') return false;

    return true;
  }

  /**
   * Calculate a SHA-256 hash of the given code string.
   *
   * @param code - Source code to hash
   * @returns Hex-encoded SHA-256 hash prefixed with "sha256:"
   */
  calculateCodeHash(code: string): string {
    const hash = createHash('sha256').update(code, 'utf-8').digest('hex');
    return `sha256:${hash}`;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * JSON.stringify replacer that serializes Map instances as plain objects.
   */
  private replacer(_key: string, value: unknown): unknown {
    if (value instanceof Map) {
      return Object.fromEntries(value);
    }
    return value;
  }

  /**
   * JSON.parse reviver - currently a pass-through; extend if needed.
   */
  private reviver(_key: string, value: unknown): unknown {
    return value;
  }
}
