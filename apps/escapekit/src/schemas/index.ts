/**
 * Schema Validation
 *
 * Runtime validation schemas using Zod for configuration,
 * MCP tool inputs, and settings.
 *
 * Inspired by Claude Code's SettingsSchema and validation patterns.
 *
 * Usage:
 *   import { NPMRegistryConfigSchema, parseConfig } from './schemas/index.js'
 *
 *   const config = parseConfig(NPMRegistryConfigSchema, rawConfig)
 *   // Throws ConfigurationError with detailed messages on invalid input
 */

import { z } from 'zod';

// ─── NPM Registry Config ───────────────────────────────────────────────────

export const NPMRegistryConfigSchema = z.object({
  registryUrl: z
    .string()
    .url('Must be a valid URL')
    .default('https://registry.npmjs.org'),
  cacheTTL: z
    .number()
    .int()
    .min(0, 'cacheTTL must be non-negative')
    .max(3_600_000, 'cacheTTL must be <= 1 hour')
    .default(300_000),
  existenceCheckTimeout: z
    .number()
    .int()
    .min(1000, 'existenceCheckTimeout must be >= 1s')
    .max(30_000, 'existenceCheckTimeout must be <= 30s')
    .default(5000),
  versionQueryTimeout: z
    .number()
    .int()
    .min(1000, 'versionQueryTimeout must be >= 1s')
    .max(60_000, 'versionQueryTimeout must be <= 60s')
    .default(10_000),
  maxRetries: z
    .number()
    .int()
    .min(0, 'maxRetries must be non-negative')
    .max(10, 'maxRetries must be <= 10')
    .default(3),
  initialRetryDelay: z
    .number()
    .int()
    .min(100, 'initialRetryDelay must be >= 100ms')
    .max(30_000, 'initialRetryDelay must be <= 30s')
    .default(1000),
  enableRetry: z.boolean().default(true),
});

export type NPMRegistryConfigInput = z.input<typeof NPMRegistryConfigSchema>;

// ─── Analyzer Config ───────────────────────────────────────────────────────

export const AnalyzerConfigSchema = z.object({
  maxFileSize: z
    .number()
    .int()
    .min(1, 'maxFileSize must be positive')
    .max(10 * 1024 * 1024, 'maxFileSize must be <= 10MB')
    .default(1024 * 1024),
  verboseLogging: z.boolean().default(false),
  defaultSandboxType: z
    .enum(['ai_studio', 'bolt', 'replit', 'unknown'])
    .default('unknown'),
  errorWeight: z
    .number()
    .min(0, 'errorWeight must be non-negative')
    .max(1, 'errorWeight must be <= 1')
    .default(0.2),
  warningWeight: z
    .number()
    .min(0, 'warningWeight must be non-negative')
    .max(1, 'warningWeight must be <= 1')
    .default(0.05),
});

export type AnalyzerConfigInput = z.input<typeof AnalyzerConfigSchema>;

// ─── MCP Tool Input Schemas ────────────────────────────────────────────────

export const AnalyzeSandboxCodeInputSchema = z.object({
  code: z.string().min(1, 'code must not be empty'),
  sandboxType: z
    .enum(['ai_studio', 'bolt', 'replit', 'auto'])
    .optional()
    .default('auto'),
  options: z
    .object({
      maxFileSize: z.number().int().positive().optional(),
      verbose: z.boolean().optional().default(false),
    })
    .optional(),
});

export const GenerateEscapeKitInputSchema = z.object({
  code: z.string().min(1, 'code must not be empty'),
  targetFramework: z
    .string()
    .optional()
    .describe('Target framework for the generated project'),
  options: z
    .object({
      includeTests: z.boolean().optional().default(false),
      includeCI: z.boolean().optional().default(false),
    })
    .optional(),
});

export const ValidateRealityInputSchema = z.object({
  projectPath: z.string().min(1, 'projectPath must not be empty'),
  checks: z
    .array(z.enum(['build', 'runtime', 'dependencies', 'security', 'webgl']))
    .optional(),
  options: z
    .object({
      autoFix: z.boolean().optional().default(false),
      maxIterations: z.number().int().min(1).max(10).optional().default(3),
    })
    .optional(),
});

// ─── Validation Helpers ────────────────────────────────────────────────────

/**
 * Parse and validate data against a schema.
 * Throws a ConfigurationError with detailed messages on failure.
 */
export function parseConfig<T extends z.ZodType>(
  schema: T,
  data: unknown,
): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new ValidationError(
      `Configuration validation failed:\n${messages.join('\n')}`,
      result.error.issues,
    );
  }
  return result.data;
}

/**
 * Validate data without throwing. Returns result object.
 */
export function safeParseConfig<T extends z.ZodType>(
  schema: T,
  data: unknown,
):
  | { success: true; data: z.output<T> }
  | { success: false; errors: z.ZodIssue[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

/**
 * Error thrown when validation fails.
 */
export class ValidationError extends Error {
  public readonly issues: z.ZodIssue[];

  constructor(message: string, issues: z.ZodIssue[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}
