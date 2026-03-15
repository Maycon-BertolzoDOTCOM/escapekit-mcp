/**
 * DependencyResolver - Main orchestrator for dependency resolution
 * 
 * This class resolves ghost imports to real packages using a three-tier strategy:
 * 1. Manual overrides (highest priority, confidence: 1.0)
 * 2. Knowledge base exact matches (confidence: 0.95)
 * 3. Semantic matching (confidence: 0.5-0.9)
 * 
 * All resolutions are validated against NPM registry and cached for performance.
 * Target: 90% cache hit rate after warmup.
 * 
 * Part of Camada 2 (Resolução) - Dependency Resolution Layer
 * 
 * @module resolvers/DependencyResolver
 */

import { 
  DependencyResolution, 
  ResolutionMethod, 
  MappingStrategy
} from '../models/transformation.js';
import { NPMRegistry } from '../services/NPMRegistry.js';
import { KnowledgeBase } from './KnowledgeBase.js';
import { SemanticMatcher } from './SemanticMatcher.js';
import { logger } from '../logger.js';

/**
 * Configuration options for DependencyResolver
 */
export interface ResolverConfig {
  /** Enable caching of resolution results */
  enableCache?: boolean;
  /** Enable NPM registry validation */
  enableValidation?: boolean;
  /** Minimum confidence threshold for semantic matches */
  minSemanticConfidence?: number;
  /** Maximum number of semantic match results */
  maxSemanticResults?: number;
  /** Enable offline mode (use cached data only) */
  offlineMode?: boolean;
  /** Enable rate limiting for NPM requests */
  enableRateLimiting?: boolean;
  /** Minimum delay between NPM requests in milliseconds */
  rateLimitDelay?: number;
}

/**
 * Cache entry for resolution results
 */
interface CacheEntry {
  resolution: DependencyResolution;
  timestamp: number;
}

/**
 * Statistics for cache performance tracking
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
}

/**
 * Statistics for NPM registry query tracking
 */
export interface NPMQueryStats {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  cacheHits: number;
  cacheMisses: number;
  unverifiedPackages: number;
  deprecatedWarnings: number;
}

/**
 * DependencyResolver class - orchestrates ghost import resolution
 * 
 * Resolution algorithm priority:
 * 1. Manual overrides (confidence: 1.0)
 * 2. Knowledge base exact matches (confidence: 0.95)
 * 3. Semantic matching (confidence: 0.5-0.9)
 * 
 * All resolved packages are validated against NPM registry to ensure they exist.
 * Results are cached to achieve 90% hit rate target.
 * 
 * @example
 * ```typescript
 * const resolver = new DependencyResolver(npmRegistry, knowledgeBase, semanticMatcher);
 * 
 * // Resolve a single ghost import
 * const resolution = await resolver.resolve('fake-api-client');
 * console.log(`${resolution.originalImport} → ${resolution.resolvedPackage} (${resolution.confidence})`);
 * 
 * // Resolve multiple imports in batch
 * const resolutions = await resolver.resolveBatch(['fake-api', 'mock-db', 'test-utils']);
 * 
 * // Add manual override
 * resolver.addManualMapping('my-ghost-package', 'real-package');
 * ```
 */
export class DependencyResolver {
  private log = logger.child('DependencyResolver');
  private cache: Map<string, CacheEntry> = new Map();
  private manualMappings: Map<string, string> = new Map();
  private cacheHits = 0;
  private cacheMisses = 0;
  
  // NPM query statistics tracking
  private npmQueryStats: NPMQueryStats = {
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    unverifiedPackages: 0,
    deprecatedWarnings: 0
  };
  
  // Rate limiting
  private lastNpmRequestTime = 0;
  
  private readonly config: Required<ResolverConfig>;

  constructor(
    private npmRegistry: NPMRegistry,
    private knowledgeBase: KnowledgeBase,
    private semanticMatcher: SemanticMatcher,
    config: ResolverConfig = {}
  ) {
    this.config = {
      enableCache: config.enableCache ?? true,
      enableValidation: config.enableValidation ?? true,
      minSemanticConfidence: config.minSemanticConfidence ?? 0.7,
      maxSemanticResults: config.maxSemanticResults ?? 5,
      offlineMode: config.offlineMode ?? false,
      enableRateLimiting: config.enableRateLimiting ?? true,
      rateLimitDelay: config.rateLimitDelay ?? 100 // 100ms between requests
    };

    this.log.info('DependencyResolver initialized', { config: this.config });
  }

  /**
   * Resolve a single ghost import to a real package
   * 
   * Uses three-tier resolution strategy:
   * 1. Check manual overrides (confidence: 1.0)
   * 2. Check knowledge base (confidence: 0.95)
   * 3. Perform semantic matching (confidence: 0.5-0.9)
   * 
   * All resolutions are validated against NPM registry.
   * Results are cached for performance.
   * 
   * @param ghostImport - The ghost package name to resolve
   * @returns DependencyResolution with confidence score between 0.0 and 1.0
   * 
   * @example
   * ```typescript
   * const resolution = await resolver.resolve('fake-api-client');
   * if (resolution.confidence > 0.7) {
   *   console.log(`High confidence: ${resolution.resolvedPackage}`);
   * }
   * ```
   */
  async resolve(ghostImport: string): Promise<DependencyResolution> {
    this.log.debug('Resolving ghost import', { ghostImport });

    // Check cache first
    if (this.config.enableCache) {
      const cached = this.getFromCache(ghostImport);
      if (cached) {
        this.cacheHits++;
        this.log.debug('Cache hit', { ghostImport, hitRate: this.getCacheHitRate() });
        return cached;
      }
      this.cacheMisses++;
    }

    // Resolution strategy: manual > knowledge base > semantic
    let resolution: DependencyResolution;

    // 1. Check manual overrides (highest priority)
    const manualMapping = this.manualMappings.get(ghostImport);
    if (manualMapping) {
      this.log.info('Using manual override', { ghostImport, realPackage: manualMapping });
      resolution = await this.createResolution(
        ghostImport,
        manualMapping,
        ResolutionMethod.USER_PROVIDED,
        1.0,
        MappingStrategy.MANUAL_OVERRIDE
      );
    }
    // 2. Check knowledge base (exact match)
    else {
      const kbMapping = this.knowledgeBase.getMapping(ghostImport);
      if (kbMapping && kbMapping.realPackages.length > 0) {
        this.log.info('Found in knowledge base', { 
          ghostImport, 
          realPackage: kbMapping.realPackages[0] 
        });
        resolution = await this.createResolution(
          ghostImport,
          kbMapping.realPackages[0],
          ResolutionMethod.KNOWLEDGE_BASE,
          0.95,
          MappingStrategy.EXACT_MATCH,
          kbMapping.realPackages.slice(1) // alternatives
        );
      }
      // 3. Perform semantic matching (fallback)
      else {
        this.log.info('Attempting semantic match', { ghostImport });
        const semanticResults = await this.semanticMatcher.findSimilar(ghostImport, {
          minSimilarity: this.config.minSemanticConfidence,
          maxResults: this.config.maxSemanticResults,
          includeDeprecated: false
        });

        if (semanticResults.length > 0) {
          const bestMatch = semanticResults[0];
          this.log.info('Found semantic match', {
            ghostImport,
            realPackage: bestMatch.realPackages[0],
            confidence: bestMatch.confidence
          });
          resolution = await this.createResolution(
            ghostImport,
            bestMatch.realPackages[0],
            ResolutionMethod.SEMANTIC_ANALYSIS,
            bestMatch.confidence,
            MappingStrategy.SEMANTIC_MATCH,
            semanticResults.slice(1).map(m => m.realPackages[0])
          );
        }
        // No match found
        else {
          this.log.warn('No resolution found', { ghostImport });
          resolution = {
            originalImport: ghostImport,
            resolvedPackage: ghostImport, // Keep original as fallback
            version: 'unknown',
            resolutionMethod: ResolutionMethod.SEMANTIC_ANALYSIS,
            confidence: 0.0,
            metadata: {
              reasoning: 'No suitable replacement found',
              alternatives: []
            }
          };
        }
      }
    }

    // Cache the result
    if (this.config.enableCache) {
      this.cacheSet(ghostImport, resolution);
    }

    this.log.info('Resolution complete', {
      ghostImport,
      resolvedPackage: resolution.resolvedPackage,
      confidence: resolution.confidence,
      method: resolution.resolutionMethod
    });

    return resolution;
  }

  /**
   * Resolve multiple ghost imports in batch
   * 
   * More efficient than individual calls as it can leverage caching
   * and parallel processing. All resolutions use the same three-tier
   * strategy as single resolution.
   * 
   * @param ghostImports - Array of ghost package names to resolve
   * @returns Array of DependencyResolution objects in the same order as input
   * 
   * @example
   * ```typescript
   * const resolutions = await resolver.resolveBatch([
   *   'fake-api',
   *   'mock-database',
   *   'test-utils'
   * ]);
   * 
   * for (const res of resolutions) {
   *   console.log(`${res.originalImport} → ${res.resolvedPackage}`);
   * }
   * ```
   */
  async resolveBatch(ghostImports: string[]): Promise<DependencyResolution[]> {
    this.log.info('Resolving batch of ghost imports', { count: ghostImports.length });

    const startTime = Date.now();

    // Resolve all imports in parallel
    const resolutions = await Promise.all(
      ghostImports.map(ghostImport => this.resolve(ghostImport))
    );

    const duration = Date.now() - startTime;
    const avgTime = duration / ghostImports.length;

    this.log.info('Batch resolution complete', {
      count: ghostImports.length,
      duration,
      avgTime,
      cacheHitRate: this.getCacheHitRate()
    });

    return resolutions;
  }

  /**
   * Add manual override mapping
   * 
   * Manual mappings have the highest priority (confidence: 1.0) and will
   * always be used instead of knowledge base or semantic matching.
   * 
   * @param ghostPackage - The ghost package name
   * @param realPackage - The real package to map to
   * 
   * @example
   * ```typescript
   * // Override the default mapping
   * resolver.addManualMapping('my-custom-api', 'axios');
   * 
   * // Now this will always resolve to axios
   * const resolution = await resolver.resolve('my-custom-api');
   * console.log(resolution.confidence); // 1.0
   * ```
   */
  addManualMapping(ghostPackage: string, realPackage: string): void {
    this.log.info('Adding manual mapping', { ghostPackage, realPackage });
    this.manualMappings.set(ghostPackage, realPackage);
    
    // Invalidate cache for this package
    this.cache.delete(ghostPackage);
  }

  /**
   * Clear resolution cache
   * 
   * Removes all cached resolutions. Useful when you want to force
   * re-resolution or when the knowledge base has been updated.
   * 
   * @example
   * ```typescript
   * // Clear cache after updating knowledge base
   * await knowledgeBase.loadFromFile('updated-kb.json');
   * resolver.clearCache();
   * ```
   */
  clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.log.info('Cache cleared', { entriesCleared: size });
  }

  /**
   * Get cache statistics
   * 
   * Returns cache performance metrics including hit rate.
   * Target hit rate is 90% after warmup.
   * 
   * @returns Cache statistics
   * 
   * @example
   * ```typescript
   * const stats = resolver.getCacheStats();
   * console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
   * console.log(`Cache size: ${stats.size} entries`);
   * ```
   */
  getCacheStats(): CacheStats {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? this.cacheHits / total : 0;

    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate,
      size: this.cache.size
    };
  }

  /**
   * Get NPM registry query statistics
   * 
   * Returns statistics about NPM registry queries including success rate,
   * cache performance, and unverified packages.
   * 
   * @returns NPM query statistics
   * 
   * @example
   * ```typescript
   * const stats = resolver.getNPMQueryStats();
   * console.log(`Total queries: ${stats.totalQueries}`);
   * console.log(`Success rate: ${(stats.successfulQueries / stats.totalQueries * 100).toFixed(1)}%`);
   * console.log(`Unverified packages: ${stats.unverifiedPackages}`);
   * ```
   */
  getNPMQueryStats(): NPMQueryStats {
    return { ...this.npmQueryStats };
  }

  /**
   * Create a DependencyResolution object with NPM validation
   * 
   * @private
   */
  private async createResolution(
    originalImport: string,
    resolvedPackage: string,
    method: ResolutionMethod,
    confidence: number,
    strategy: MappingStrategy,
    alternatives: string[] = []
  ): Promise<DependencyResolution> {
    // Ensure confidence is bounded between 0.0 and 1.0
    const boundedConfidence = Math.min(1.0, Math.max(0.0, confidence));

    let version = 'unknown';
    const npmInfo: { downloads?: number; lastUpdate?: string; deprecated?: boolean } | undefined = undefined;
    let validationStatus: 'VERIFIED' | 'UNVERIFIED' = 'VERIFIED';
    let finalConfidence = boundedConfidence;

    // Validate package exists in NPM registry
    if (this.config.enableValidation) {
      // Check if we're in offline mode
      if (this.config.offlineMode) {
        this.log.debug('Offline mode: skipping NPM validation', { resolvedPackage });
        // In offline mode, we can't verify, so mark as UNVERIFIED unless we have cached data
        const cached = this.npmRegistry.getCacheStats();
        if (cached.size === 0) {
          validationStatus = 'UNVERIFIED';
          this.npmQueryStats.unverifiedPackages++;
          this.log.warn('Offline mode with no cache: marking as UNVERIFIED', { resolvedPackage });
        }
      } else {
        // Apply rate limiting if enabled
        if (this.config.enableRateLimiting) {
          await this.applyRateLimit();
        }

        try {
          this.npmQueryStats.totalQueries++;
          
          const exists = await this.npmRegistry.packageExists(resolvedPackage);
          if (exists) {
            version = await this.npmRegistry.getLatestVersion(resolvedPackage);
            this.npmQueryStats.successfulQueries++;
            this.log.debug('Package validated', { resolvedPackage, version });
            
            // TODO: Check if package is deprecated
            // This would require fetching full package metadata
            // For now, we'll log a placeholder warning
            // In a future enhancement, we could add npmRegistry.getPackageMetadata()
            // that returns { deprecated: boolean, deprecationMessage?: string }
            
          } else {
            this.log.warn('Package does not exist in NPM registry', { resolvedPackage });
            validationStatus = 'UNVERIFIED';
            this.npmQueryStats.unverifiedPackages++;
            this.npmQueryStats.failedQueries++;
            // Lower confidence if package doesn't exist
            finalConfidence = Math.min(boundedConfidence, 0.3);
          }
        } catch (error) {
          this.log.warn('Failed to validate package - marking as UNVERIFIED', { 
            resolvedPackage, 
            error: error instanceof Error ? error.message : String(error) 
          });
          validationStatus = 'UNVERIFIED';
          this.npmQueryStats.unverifiedPackages++;
          this.npmQueryStats.failedQueries++;
          // Keep original confidence but mark as unverified
        }
      }
    }

    const resolution: DependencyResolution = {
      originalImport,
      resolvedPackage,
      version,
      resolutionMethod: method,
      confidence: finalConfidence,
      metadata: {
        alternatives,
        reasoning: this.getReasoningText(method, strategy, finalConfidence, validationStatus),
        npmInfo,
        validationStatus
      }
    };

    return resolution;
  }

  /**
   * Generate reasoning text based on resolution method and strategy
   * 
   * @private
   */
  private getReasoningText(
    method: ResolutionMethod,
    _strategy: MappingStrategy,
    confidence: number,
    validationStatus?: 'VERIFIED' | 'UNVERIFIED'
  ): string {
    let baseReasoning: string;
    
    switch (method) {
      case ResolutionMethod.USER_PROVIDED:
        baseReasoning = 'Manual override provided by user';
        break;
      case ResolutionMethod.KNOWLEDGE_BASE:
        baseReasoning = 'Exact match found in knowledge base';
        break;
      case ResolutionMethod.SEMANTIC_ANALYSIS:
        baseReasoning = `Semantic match with ${(confidence * 100).toFixed(0)}% confidence`;
        break;
      case ResolutionMethod.NPM_SEARCH:
        baseReasoning = 'Found via NPM registry search';
        break;
      default:
        baseReasoning = 'Resolution method unknown';
    }

    if (validationStatus === 'UNVERIFIED') {
      baseReasoning += ' (UNVERIFIED - validation failed or offline mode)';
    }

    return baseReasoning;
  }

  /**
   * Apply rate limiting delay between NPM requests
   * 
   * @private
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastNpmRequestTime;
    
    if (timeSinceLastRequest < this.config.rateLimitDelay) {
      const delay = this.config.rateLimitDelay - timeSinceLastRequest;
      this.log.debug('Rate limiting: waiting', { delay });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastNpmRequestTime = Date.now();
  }

  /**
   * Get cached resolution if available
   * 
   * @private
   */
  private getFromCache(ghostImport: string): DependencyResolution | null {
    const entry = this.cache.get(ghostImport);
    if (!entry) {
      return null;
    }

    // Cache entries don't expire in this implementation
    // Could add TTL if needed
    return entry.resolution;
  }

  /**
   * Store resolution in cache
   * 
   * @private
   */
  private cacheSet(ghostImport: string, resolution: DependencyResolution): void {
    this.cache.set(ghostImport, {
      resolution,
      timestamp: Date.now()
    });
  }

  /**
   * Calculate current cache hit rate
   * 
   * @private
   */
  private getCacheHitRate(): number {
    const total = this.cacheHits + this.cacheMisses;
    return total > 0 ? this.cacheHits / total : 0;
  }
}
