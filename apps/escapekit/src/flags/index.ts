/**
 * Feature Flags
 *
 * Lightweight feature flag system for controlling experimental features.
 * Supports:
 *   - Static flags (environment variables, config files)
 *   - Dynamic flags (GrowthBook integration when available)
 *   - Flag overrides for testing
 *
 * Inspired by Claude Code's feature() pattern with 533+ flag usages.
 *
 * Usage:
 *   import { feature, setFlagOverride, initFlags } from './flags/index.js'
 *
 *   // Initialize (call once at startup)
 *   await initFlags()
 *
 *   // Check a flag
 *   if (feature('enable_security_scanning')) {
 *     // security scanning logic
 *   }
 *
 *   // Override for testing
 *   setFlagOverride('enable_federated_learning', true)
 */

import { createLogger } from '../logger.js';

const logger = createLogger('Flags');

// ─── Flag Definitions ──────────────────────────────────────────────────────

/**
 * All known feature flags with their defaults.
 * Add new flags here.
 */
export const FLAG_DEFAULTS = {
  enable_federated_learning: false,
  enable_semantic_matching: false,
  enable_security_scanning: false,
  enable_auto_fix: true,
  enable_hook_system: true,
  enable_cache: true,
  enable_retry: true,
  governance_strategy: 'fast' as string,
  max_auto_fix_iterations: 3,
  analysis_timeout_ms: 30000,
} as const;

export type FlagName = keyof typeof FLAG_DEFAULTS;
export type FlagValue = boolean | string | number;

// ─── Flag State ────────────────────────────────────────────────────────────

const envOverrides: Partial<Record<FlagName, FlagValue>> = {};
let testOverrides: Partial<Record<FlagName, FlagValue>> = {};
let growthbookInstance: { isOn(key: string): boolean; getFeatureValue<T>(key: string, fallback: T): T } | null = null;

/**
 * Initialize flags from environment variables.
 * Reads ESCAPEKIT_FLAG_<NAME> env vars.
 *
 * Usage:
 *   ESCAPEKIT_FLAG_ENABLE_SECURITY_SCANNING=true node dist/cli/index.js
 */
export async function initFlags(): Promise<void> {
  // Read from environment variables
  for (const name of Object.keys(FLAG_DEFAULTS) as FlagName[]) {
    const envKey = `ESCAPEKIT_FLAG_${name.toUpperCase()}`;
    const envValue = process.env[envKey];

    if (envValue !== undefined) {
      envOverrides[name] = parseEnvValue(envValue, FLAG_DEFAULTS[name]);
      logger.debug(`Flag from env: ${name} = ${envOverrides[name]}`);
    }
  }

  // Try to initialize GrowthBook if available
  const clientKey = process.env.GB_CLIENT_KEY;
  const apiHost = process.env.GB_API_HOST;

  if (clientKey && apiHost) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const mod: any = await import('@growthbook/growthbook' as string);
      const GrowthBook = mod.GrowthBook;
      growthbookInstance = new GrowthBook({
        apiHost,
        clientKey,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any as typeof growthbookInstance;
      await (growthbookInstance as unknown as { loadFeatures(): Promise<void> }).loadFeatures();
      logger.info('GrowthBook initialized', { apiHost });
    } catch {
      logger.debug('GrowthBook not available, using static flags');
    }
  }

  logger.info(`Flags initialized: ${Object.keys(FLAG_DEFAULTS).length} flags`);
}

/**
 * Check a feature flag value.
 *
 * Priority: test override > env override > GrowthBook > default
 */
export function feature(name: FlagName): boolean {
  const value = getFeatureValue(name, FLAG_DEFAULTS[name]);
  return Boolean(value);
}

/**
 * Get a feature flag value with fallback.
 *
 * Priority: test override > env override > GrowthBook > fallback
 */
export function getFeatureValue<T extends FlagValue>(name: FlagName, fallback: T): T {
  // Test override (highest priority)
  if (name in testOverrides) {
    return testOverrides[name] as T;
  }

  // Environment override
  if (name in envOverrides) {
    return envOverrides[name] as T;
  }

  // GrowthBook
  if (growthbookInstance) {
    try {
      const gbValue = growthbookInstance.getFeatureValue(name, fallback);
      if (gbValue !== fallback) {
        return gbValue as T;
      }
    } catch {
      // GrowthBook error — fall through to default
    }
  }

  return fallback;
}

/**
 * Set a flag override for testing.
 * Takes highest priority.
 */
export function setFlagOverride(name: FlagName, value: FlagValue): void {
  testOverrides[name] = value;
  logger.debug(`Flag override set: ${name} = ${value}`);
}

/**
 * Clear a specific flag override
 */
export function clearFlagOverride(name: FlagName): void {
  delete testOverrides[name];
}

/**
 * Clear all flag overrides
 */
export function clearAllFlagOverrides(): void {
  testOverrides = {};
}

/**
 * Get all current flag values (for debugging/logging)
 */
export function getAllFlags(): Record<string, FlagValue> {
  const result: Record<string, FlagValue> = {};
  for (const [name, defaultValue] of Object.entries(FLAG_DEFAULTS)) {
    result[name] = getFeatureValue(name as FlagName, defaultValue);
  }
  return result;
}

/**
 * Parse an environment variable string to the appropriate type
 */
function parseEnvValue(value: string, defaultValue: FlagValue): FlagValue {
  if (typeof defaultValue === 'boolean') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  if (typeof defaultValue === 'number') {
    const parsed = Number(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return value;
}
