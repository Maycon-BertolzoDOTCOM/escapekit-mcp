/**
 * NPM Registry Service
 * 
 * Handles queries to npm registry to check if packages exist
 * and retrieve their latest versions with retry logic and caching
 */

import { DEFAULT_NPM_REGISTRY_CONFIG, validateNPMRegistryConfig, type NPMRegistryConfig } from '../config.js';
import { logger } from '../logger.js';
import { NPMRegistryError, TimeoutError, PackageNotFoundError } from '../errors.js';

interface PackageInfo {
  name: string;
  version: string;
  exists: boolean;
  status: 'FOUND' | 'NOT_FOUND' | 'UNVERIFIED_NETWORK_ERROR' | 'UNVERIFIED_TIMEOUT' | 'BUILTIN';
}

interface CacheEntry {
  data: PackageInfo;
  timestamp: number;
}

export class NPMRegistry {
  private readonly config: NPMRegistryConfig;
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly scriptsCache: Map<string, Record<string, string> | null> = new Map();
  private readonly nodeBuiltins: Set<string>;
  private readonly logger = logger.child('NPMRegistry');

  constructor(config: Partial<NPMRegistryConfig> = {}) {
    this.config = { ...DEFAULT_NPM_REGISTRY_CONFIG, ...config };
    validateNPMRegistryConfig(this.config);
    
    this.nodeBuiltins = new Set([
      'fs', 'path', 'http', 'https', 'url', 'querystring',
      'util', 'events', 'stream', 'buffer', 'crypto', 'os',
      'child_process', 'cluster', 'net', 'dgram', 'dns',
      'readline', 'repl', 'vm', 'zlib', 'assert', 'tty',
      'module', 'worker_threads', 'perf_hooks', 'console',
      'process', 'global', '__filename', '__dirname',
    ]);

    this.logger.debug('NPMRegistry initialized', { config: this.config });
  }

  /**
   * Check if a package is a Node.js built-in module
   */
  isNodeBuiltin(packageName: string): boolean {
    return this.nodeBuiltins.has(packageName);
  }

  /**
   * Check if a package exists on npm registry with retry logic
   */
  async packageExists(packageName: string): Promise<boolean> {
    // Check cache first
    const cached = this.getFromCache(packageName);
    if (cached) {
      this.logger.debug(`Cache hit for package: ${packageName}`);
      return cached.exists;
    }

    // Skip Node.js built-ins
    if (this.isNodeBuiltin(packageName)) {
      this.logger.debug(`Skipping Node.js builtin: ${packageName}`);
      this.cacheSet(packageName, {
        name: packageName,
        version: 'builtin',
        exists: true,
        status: 'BUILTIN',
      });
      return true;
    }

    try {
      this.logger.debug(`Checking package existence: ${packageName}`);
      
      if (this.config.enableRetry) {
        const exists = await this.retryOperation(
          () => this.checkPackageExistence(packageName),
          packageName,
          'existence check'
        );
        
        return exists;
      } else {
        return await this.checkPackageExistence(packageName);
      }
    } catch (error) {
      this.logger.warn(`Failed to check package ${packageName}`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  /**
   * Internal method to check package existence
   */
  private async checkPackageExistence(packageName: string): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.existenceCheckTimeout);

    try {
      const response = await fetch(`${this.config.registryUrl}/${packageName}`, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status >= 500) {
        throw new NPMRegistryError(`Server error (${response.status}) checking package existence`, packageName);
      }

      if (response.status === 404) {
        // Cache the NOT_FOUND result
        this.cacheSet(packageName, {
          name: packageName,
          version: 'unknown',
          exists: false,
          status: 'NOT_FOUND',
        });
        // Throw PackageNotFoundError to signal non-retryable error
        throw new PackageNotFoundError(packageName);
      }

      const exists = response.ok;
      
      // Cache successful responses
      if (response.ok) {
        this.cacheSet(packageName, {
          name: packageName,
          version: 'unknown', // Version will be fetched separately
          exists: true,
          status: 'FOUND',
        });
      }

      this.logger.debug(`Package ${packageName} exists: ${exists}`);
      return exists;
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Re-throw PackageNotFoundError as-is (non-retryable)
      if (error instanceof PackageNotFoundError) {
        throw error;
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError('package existence check', this.config.existenceCheckTimeout, { packageName });
      }
      
      throw new NPMRegistryError(
        `Failed to check package existence: ${error instanceof Error ? error.message : String(error)}`,
        packageName
      );
    }
  }

  /**
   * Get the latest version of a package with retry logic
   */
  async getLatestVersion(packageName: string): Promise<string> {
    // Check cache first
    const cached = this.getFromCache(packageName);
    if (cached && cached.version !== 'unknown' && cached.version !== 'builtin') {
      this.logger.debug(`Cache hit for version: ${packageName} -> ${cached.version}`);
      return cached.version;
    }

    // Skip Node.js built-ins
    if (this.isNodeBuiltin(packageName)) {
      return 'builtin';
    }

    try {
      this.logger.debug(`Getting latest version: ${packageName}`);
      
      if (this.config.enableRetry) {
        return await this.retryOperation(
          () => this.fetchPackageVersion(packageName),
          packageName,
          'version query'
        );
      } else {
        return await this.fetchPackageVersion(packageName);
      }
    } catch (error) {
      this.logger.warn(`Failed to get latest version for ${packageName}`, { error: error instanceof Error ? error.message : String(error) });
      return 'unknown';
    }
  }

  /**
   * Internal method to fetch package version
   */
  private async fetchPackageVersion(packageName: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.versionQueryTimeout);

    try {
      const response = await fetch(`${this.config.registryUrl}/${packageName}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status >= 500) {
        throw new NPMRegistryError(`Server error (${response.status}) fetching package version`, packageName);
      }

      if (!response.ok) {
        throw new PackageNotFoundError(packageName);
      }

      const data = (await response.json()) as any;
      const version = data['dist-tags']?.latest || data.version || 'unknown';

      this.cacheSet(packageName, {
        name: packageName,
        version,
        exists: true,
        status: 'FOUND',
      });

      this.logger.debug(`Package ${packageName} version: ${version}`);
      return version;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof PackageNotFoundError) {
        throw error;
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError('package version query', this.config.versionQueryTimeout, { packageName });
      }
      
      throw new NPMRegistryError(
        `Failed to get package version: ${error instanceof Error ? error.message : String(error)}`,
        packageName
      );
    }
  }

  /**
   * Fetch the scripts field from a specific package version on the npm registry.
   * Returns the scripts object, {} if absent, or null on 404/network error/timeout.
   * Uses a separate cache keyed by "${name}@${version}".
   * Requirements: 6.3, 12.4
   */
  async fetchPackageScripts(
    name: string,
    version: string
  ): Promise<Record<string, string> | null> {
    const cacheKey = `${name}@${version}`;

    // Return cached value if present (even if null)
    if (this.scriptsCache.has(cacheKey)) {
      this.logger.debug(`Scripts cache hit for: ${cacheKey}`);
      return this.scriptsCache.get(cacheKey)!;
    }

    try {
      const scripts = await this.retryOperation(
        () => this.fetchScriptsFromRegistry(name, version),
        name,
        'scripts fetch'
      );
      // retryOperation returns null (from fetchScriptsFromRegistry on 404)
      // or a scripts object on success.
      // On network/timeout exhaustion it returns 'unknown' as a sentinel — treat as null (don't cache).
      if (scripts === ('unknown' as unknown)) {
        return null;
      }
      // Cache and return (null means 404, {} means no scripts field)
      this.scriptsCache.set(cacheKey, scripts);
      return scripts;
    } catch {
      // Network error or timeout after retries — don't cache, return null
      return null;
    }
  }

  /**
   * Internal method to fetch scripts from the registry for a specific version.
   */
  private async fetchScriptsFromRegistry(
    name: string,
    version: string
  ): Promise<Record<string, string> | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.versionQueryTimeout);

    try {
      const response = await fetch(`${this.config.registryUrl}/${name}/${version}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 404) {
        // Definitive not-found — cache null
        return null;
      }

      if (response.status >= 500) {
        throw new NPMRegistryError(
          `Server error (${response.status}) fetching scripts for ${name}@${version}`,
          name
        );
      }

      if (!response.ok) {
        throw new NPMRegistryError(
          `Unexpected status ${response.status} fetching scripts for ${name}@${version}`,
          name
        );
      }

      const data = (await response.json()) as any;
      return (data.scripts as Record<string, string>) ?? {};
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof NPMRegistryError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError('scripts fetch', this.config.versionQueryTimeout, { packageName: name });
      }

      throw new NPMRegistryError(
        `Failed to fetch scripts for ${name}@${version}: ${error instanceof Error ? error.message : String(error)}`,
        name
      );
    }
  }

  /**
   * Check multiple packages at once
   */
  async checkPackages(packageNames: string[]): Promise<Map<string, PackageInfo>> {
    const results = new Map<string, PackageInfo>();
    
    this.logger.debug(`Checking ${packageNames.length} packages`);

    await Promise.all(
      packageNames.map(async (name) => {
        const exists = await this.packageExists(name);
        const version = exists ? await this.getLatestVersion(name) : 'unknown';
        // Determine status based on existence and whether it's a builtin
        let status: 'FOUND' | 'NOT_FOUND' | 'UNVERIFIED_NETWORK_ERROR' | 'UNVERIFIED_TIMEOUT' | 'BUILTIN';
        
        if (this.isNodeBuiltin(name)) {
          status = 'BUILTIN';
        } else if (exists) {
          status = 'FOUND';
        } else {
          // If version is 'unknown', it might be a network error or just not found
          // We need a better way to check if it was a definitive 404
          const cached = this.getCacheEntry(name);
          status = (cached && cached.status === 'NOT_FOUND') ? 'NOT_FOUND' : 'UNVERIFIED_NETWORK_ERROR';
        }

        results.set(name, {
          name,
          version,
          exists,
          status,
        });
      })
    );

    this.logger.info(`Checked ${packageNames.length} packages`, { 
      found: Array.from(results.values()).filter(r => r.exists).length 
    });
    
    return results;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.info(`Cache cleared (${size} entries)`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: Array<{ key: string; age: number }> } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: Date.now() - entry.timestamp,
    }));
    
    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Get raw cache entry
   */
  private getCacheEntry(packageName: string): PackageInfo | null {
    const entry = this.cache.get(packageName);
    if (!entry) return null;
    return entry.data;
  }

  /**
   * Get cached entry if not expired
   */
  private getFromCache(packageName: string): PackageInfo | null {
    const entry = this.cache.get(packageName);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.config.cacheTTL) {
      this.logger.debug(`Cache expired for: ${packageName}`);
      this.cache.delete(packageName);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cache entry
   */
  private cacheSet(packageName: string, data: PackageInfo): void {
    this.cache.set(packageName, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Retry operation with exponential backoff - handles errors gracefully
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    packageName: string,
    operationName: string
  ): Promise<T> {
    let lastError: Error | undefined;
    
    // Always attempt the operation the configured number of times
    // maxRetries should include the initial attempt, so we need maxRetries + 1 total attempts
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on certain error types - these are definitive failures
        if (error instanceof PackageNotFoundError) {
          // 404 errors are definitive - don't retry
          this.logger.debug(`${operationName} failed for ${packageName} with definitive error, not retrying`, { error: error.message });
          if (operationName === 'existence check') {
            return false as T;
          } else {
            return 'unknown' as T;
          }
        }
        
        if (attempt < this.config.maxRetries) {
          const delay = this.config.initialRetryDelay * Math.pow(2, attempt);
          this.logger.warn(
            `${operationName} failed for ${packageName} (attempt ${attempt + 1}/${this.config.maxRetries + 1}), retrying in ${delay}ms`,
            { error: error instanceof Error ? error.message : String(error) }
          );
          await this.sleep(delay);
        } else {
          // After max retries, log error but don't throw - return default value
          this.logger.warn(
            `${operationName} failed for ${packageName} after ${this.config.maxRetries + 1} attempts, marking as unverified`,
            { error: lastError.message }
          );
          
          // Return appropriate default value based on operation type
          if (operationName === 'existence check') {
            // For existence check, return false (package doesn't exist)
            return false as T;
          } else {
            // For version query, return 'unknown'
            return 'unknown' as T;
          }
        }
      }
    }
    
    // This should never be reached, but return default for safety
    return 'unknown' as T;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}