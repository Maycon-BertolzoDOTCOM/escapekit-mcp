/**
 * Configuration
 * 
 * Centralized configuration for EscapeKit components
 */

export interface NPMRegistryConfig {
  /** NPM registry URL */
  registryUrl: string;
  /** Cache TTL in milliseconds */
  cacheTTL: number;
  /** Package existence check timeout in milliseconds */
  existenceCheckTimeout: number;
  /** Version query timeout in milliseconds */
  versionQueryTimeout: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Initial retry delay in milliseconds */
  initialRetryDelay: number;
  /** Enable retry with exponential backoff */
  enableRetry: boolean;
}

export interface AnalyzerConfig {
  /** Maximum file size in bytes to analyze */
  maxFileSize: number;
  /** Enable detailed logging */
  verboseLogging: boolean;
  /** Default sandbox type */
  defaultSandboxType: string;
  /** Confidence score calculation weight for errors */
  errorWeight: number;
  /** Confidence score calculation weight for warnings */
  warningWeight: number;
}

export const DEFAULT_NPM_REGISTRY_CONFIG: NPMRegistryConfig = {
  registryUrl: 'https://registry.npmjs.org',
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  existenceCheckTimeout: 5000, // 5 seconds
  versionQueryTimeout: 10000, // 10 seconds
  maxRetries: 3,
  initialRetryDelay: 1000, // 1 second
  enableRetry: true,
};

export const DEFAULT_ANALYZER_CONFIG: AnalyzerConfig = {
  maxFileSize: 1024 * 1024, // 1MB
  verboseLogging: false,
  defaultSandboxType: 'unknown',
  errorWeight: 0.2,
  warningWeight: 0.05,
};

/**
 * Validate NPM registry configuration
 */
export function validateNPMRegistryConfig(config: NPMRegistryConfig): void {
  if (!config.registryUrl || !config.registryUrl.startsWith('http')) {
    throw new Error('Invalid registryUrl: must be a valid HTTP/HTTPS URL');
  }
  if (config.cacheTTL <= 0) {
    throw new Error('Invalid cacheTTL: must be positive');
  }
  if (config.existenceCheckTimeout <= 0) {
    throw new Error('Invalid existenceCheckTimeout: must be positive');
  }
  if (config.versionQueryTimeout <= 0) {
    throw new Error('Invalid versionQueryTimeout: must be positive');
  }
  if (config.maxRetries < 0) {
    throw new Error('Invalid maxRetries: must be non-negative');
  }
  if (config.initialRetryDelay <= 0) {
    throw new Error('Invalid initialRetryDelay: must be positive');
  }
}

/**
 * Validate analyzer configuration
 */
export function validateAnalyzerConfig(config: AnalyzerConfig): void {
  if (config.maxFileSize <= 0) {
    throw new Error('Invalid maxFileSize: must be positive');
  }
  if (config.errorWeight < 0) {
    throw new Error('Invalid errorWeight: must be non-negative');
  }
  if (config.warningWeight < 0) {
    throw new Error('Invalid warningWeight: must be non-negative');
  }
}