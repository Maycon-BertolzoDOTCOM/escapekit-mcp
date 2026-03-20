/**
 * SemanticMatcher - Fuzzy matching for package names
 * 
 * This class performs semantic analysis to find similar packages when exact matches
 * don't exist in the knowledge base. It uses Levenshtein distance for string similarity,
 * analyzes package metadata (keywords, downloads, maintenance), and ranks results by
 * a combined confidence score.
 * 
 * Part of Camada 2 (Resolução) - Dependency Resolution Layer
 * 
 * @module resolvers/SemanticMatcher
 */

import { PackageMapping, MappingStrategy } from '../models/transformation.js';
import { NPMRegistry } from '../services/NPMRegistry.js';
import { logger } from '../logger.js';

/**
 * Package metadata for semantic analysis
 */
export interface PackageMetadata {
  name: string;
  description?: string;
  keywords?: string[];
  downloads?: number;
  lastUpdate?: string;
  deprecated?: boolean;
  version?: string;
}

/**
 * Options for semantic search
 */
export interface SemanticSearchOptions {
  /** Minimum similarity threshold (0.0-1.0), default: 0.7 */
  minSimilarity?: number;
  /** Maximum number of results to return, default: 5 */
  maxResults?: number;
  /** Include deprecated packages in results, default: false */
  includeDeprecated?: boolean;
}

/**
 * SemanticMatcher class for fuzzy package name matching
 * 
 * Uses Levenshtein distance algorithm combined with keyword analysis,
 * download statistics, and maintenance status to find similar packages.
 * 
 * Similarity scoring formula:
 * - Name similarity (Levenshtein): 40% weight
 * - Keyword overlap: 30% weight
 * - Download count: 20% weight
 * - Maintenance status: 10% weight
 * 
 * @example
 * ```typescript
 * const matcher = new SemanticMatcher(npmRegistry);
 * const results = await matcher.findSimilar('three-js', {
 *   minSimilarity: 0.7,
 *   maxResults: 5
 * });
 * 
 * for (const mapping of results) {
 *   console.log(`${mapping.ghostPackage} → ${mapping.realPackages[0]} (${mapping.confidence})`);
 * }
 * ```
 */
export class SemanticMatcher {
  private log = logger.child('SemanticMatcher');
  private metadataCache: Map<string, PackageMetadata> = new Map();

  constructor(private npmRegistry: NPMRegistry) {}

  /**
   * Find semantically similar packages
   * 
   * Searches for packages with similar names and functionality, ranking them
   * by a combined confidence score. Filters out deprecated packages and applies
   * minimum similarity threshold.
   * 
   * @param ghostPackage - The ghost package name to find alternatives for
   * @param options - Search options (minSimilarity, maxResults, includeDeprecated)
   * @returns Array of PackageMapping objects ranked by confidence (descending)
   * 
   * @example
   * ```typescript
   * const results = await matcher.findSimilar('react-dom-server', {
   *   minSimilarity: 0.7,
   *   maxResults: 5,
   *   includeDeprecated: false
   * });
   * ```
   */
  async findSimilar(
    ghostPackage: string,
    options?: SemanticSearchOptions
  ): Promise<PackageMapping[]> {
    const minSimilarity = options?.minSimilarity ?? 0.7;
    const maxResults = options?.maxResults ?? 5;
    const includeDeprecated = options?.includeDeprecated ?? false;

    this.log.debug('Finding similar packages', {
      ghostPackage,
      minSimilarity,
      maxResults,
      includeDeprecated
    });

    // Generate candidate package names based on the ghost package
    const candidates = this.generateCandidates(ghostPackage);

    this.log.debug('Generated candidates', {
      ghostPackage,
      candidateCount: candidates.length,
      candidates: candidates.slice(0, 10) // Log first 10 for debugging
    });

    // Analyze each candidate and calculate similarity
    const mappings: PackageMapping[] = [];

    for (const candidate of candidates) {
      try {
        // Check if package exists
        const exists = await this.npmRegistry.packageExists(candidate);
        if (!exists) {
          continue;
        }

        // Get package metadata
        const metadata = await this.analyzePackage(candidate);

        // Skip deprecated packages unless explicitly included
        if (metadata.deprecated && !includeDeprecated) {
          this.log.debug('Skipping deprecated package', { candidate });
          continue;
        }

        // Calculate similarity score
        const similarity = this.calculateSimilarity(ghostPackage, candidate, metadata);

        // Apply minimum threshold
        if (similarity < minSimilarity) {
          continue;
        }

        // Create package mapping
        const mapping: PackageMapping = {
          ghostPackage,
          realPackages: [candidate],
          confidence: similarity,
          mappingStrategy: MappingStrategy.SEMANTIC_MATCH,
          metadata: {
            reason: `Semantic match (similarity: ${similarity.toFixed(2)})`,
            source: 'semantic-analysis',
            alternatives: []
          }
        };

        mappings.push(mapping);

      } catch (error) {
        this.log.warn('Error analyzing candidate package', { candidate, error: error instanceof Error ? error.message : String(error) });
        continue;
      }
    }

    // Sort by confidence (descending) and limit results
    const sortedMappings = mappings
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxResults);

    this.log.info('Found similar packages', {
      ghostPackage,
      resultsCount: sortedMappings.length,
      topMatch: sortedMappings[0]?.realPackages[0],
      topConfidence: sortedMappings[0]?.confidence
    });

    return sortedMappings;
  }

  /**
   * Calculate similarity score between ghost package and candidate
   * 
   * Combines multiple factors:
   * - Name similarity (Levenshtein distance): 40%
   * - Keyword overlap: 30%
   * - Download count (normalized): 20%
   * - Maintenance status (last update): 10%
   * 
   * @param ghostPackage - The ghost package name
   * @param candidateName - The candidate package name
   * @param metadata - Package metadata for the candidate
   * @returns Similarity score between 0.0 and 1.0
   * 
   * @example
   * ```typescript
   * const similarity = matcher.calculateSimilarity('three-js', 'three', {
   *   name: 'three',
   *   keywords: ['3d', 'webgl', 'graphics'],
   *   downloads: 5000000,
   *   lastUpdate: '2024-01-15'
   * });
   * ```
   */
  calculateSimilarity(
    ghostPackage: string,
    candidateName: string,
    metadata?: PackageMetadata
  ): number {
    // 1. Name similarity using Levenshtein distance (40% weight)
    const nameSimilarity = this.calculateNameSimilarity(ghostPackage, candidateName);

    // 2. Keyword overlap (30% weight)
    const keywordScore = this.calculateKeywordScore(ghostPackage, metadata?.keywords || []);

    // 3. Download score (20% weight) - normalized
    const downloadScore = this.calculateDownloadScore(metadata?.downloads || 0);

    // 4. Maintenance score (10% weight) - based on last update
    const maintenanceScore = this.calculateMaintenanceScore(metadata?.lastUpdate);

    // Combine scores with weights
    const similarity =
      0.4 * nameSimilarity +
      0.3 * keywordScore +
      0.2 * downloadScore +
      0.1 * maintenanceScore;

    this.log.debug('Calculated similarity', {
      ghostPackage,
      candidateName,
      nameSimilarity,
      keywordScore,
      downloadScore,
      maintenanceScore,
      totalSimilarity: similarity
    });

    return Math.min(1.0, Math.max(0.0, similarity));
  }

  /**
   * Analyze package metadata for semantic matching
   * 
   * Retrieves package information from npm registry including description,
   * keywords, download statistics, and maintenance status. Results are cached
   * to improve performance.
   * 
   * @param packageName - The package name to analyze
   * @returns Package metadata
   * 
   * @example
   * ```typescript
   * const metadata = await matcher.analyzePackage('axios');
   * console.log(`Downloads: ${metadata.downloads}`);
   * console.log(`Keywords: ${metadata.keywords?.join(', ')}`);
   * ```
   */
  async analyzePackage(packageName: string): Promise<PackageMetadata> {
    // Check cache first
    const cached = this.metadataCache.get(packageName);
    if (cached) {
      this.log.debug('Using cached metadata', { packageName });
      return cached;
    }

    this.log.debug('Fetching package metadata', { packageName });

    try {
      // Get version first to ensure package exists
      const version = await this.npmRegistry.getLatestVersion(packageName);

      // For now, we'll create basic metadata
      // In a full implementation, this would fetch from npm registry API
      const metadata: PackageMetadata = {
        name: packageName,
        version,
        description: undefined,
        keywords: this.extractKeywordsFromName(packageName),
        downloads: undefined,
        lastUpdate: undefined,
        deprecated: false
      };

      // Cache the metadata
      this.metadataCache.set(packageName, metadata);

      return metadata;

    } catch (error) {
      this.log.warn('Failed to analyze package', { packageName, error: error instanceof Error ? error.message : String(error) });
      
      // Return minimal metadata on error
      return {
        name: packageName,
        keywords: this.extractKeywordsFromName(packageName),
        deprecated: false
      };
    }
  }

  /**
   * Calculate Levenshtein distance between two strings
   * 
   * Uses dynamic programming to compute the minimum number of single-character
   * edits (insertions, deletions, substitutions) required to change one string
   * into another.
   * 
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Levenshtein distance (number of edits)
   * 
   * @example
   * ```typescript
   * const distance = matcher.levenshteinDistance('three-js', 'three');
   * // Returns: 3 (delete '-', 'j', 's')
   * ```
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    // Create 2D array for dynamic programming
    const dp: number[][] = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(0));

    // Initialize first row and column
    for (let i = 0; i <= len1; i++) {
      dp[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      dp[0][j] = j;
    }

    // Fill the DP table
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,     // deletion
            dp[i][j - 1] + 1,     // insertion
            dp[i - 1][j - 1] + 1  // substitution
          );
        }
      }
    }

    return dp[len1][len2];
  }

  /**
   * Calculate name similarity using normalized Levenshtein distance
   * 
   * Normalizes the Levenshtein distance by the length of the longer string
   * to get a similarity score between 0.0 and 1.0.
   * 
   * @param name1 - First package name
   * @param name2 - Second package name
   * @returns Similarity score (0.0 = completely different, 1.0 = identical)
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    // Normalize names (lowercase, remove special chars)
    const normalized1 = name1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalized2 = name2.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Handle exact match
    if (normalized1 === normalized2) {
      return 1.0;
    }

    // Handle substring match (high similarity)
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      const shorter = Math.min(normalized1.length, normalized2.length);
      const longer = Math.max(normalized1.length, normalized2.length);
      return shorter / longer;
    }

    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);

    // Normalize to 0.0-1.0 range (1.0 = identical, 0.0 = completely different)
    return maxLength > 0 ? 1.0 - distance / maxLength : 0.0;
  }

  /**
   * Calculate keyword overlap score
   * 
   * Compares keywords extracted from the ghost package name with the
   * candidate's keywords to determine functional similarity.
   * 
   * @param ghostPackage - Ghost package name
   * @param candidateKeywords - Keywords from candidate package
   * @returns Keyword overlap score (0.0-1.0)
   */
  private calculateKeywordScore(ghostPackage: string, candidateKeywords: string[]): number {
    const ghostKeywords = this.extractKeywordsFromName(ghostPackage);

    if (ghostKeywords.length === 0 || candidateKeywords.length === 0) {
      return 0.0;
    }

    // Count overlapping keywords
    const overlap = ghostKeywords.filter(kw =>
      candidateKeywords.some(ck => ck.toLowerCase().includes(kw.toLowerCase()))
    ).length;

    // Normalize by the number of ghost keywords
    return overlap / ghostKeywords.length;
  }

  /**
   * Calculate download score (normalized)
   * 
   * Normalizes weekly download count to a 0.0-1.0 score using logarithmic scale.
   * Popular packages (>1M downloads/week) get scores close to 1.0.
   * 
   * @param downloads - Weekly download count
   * @returns Normalized download score (0.0-1.0)
   */
  private calculateDownloadScore(downloads: number): number {
    if (downloads <= 0) {
      return 0.0;
    }

    // Use logarithmic scale: log10(downloads) / log10(10M)
    // 10M downloads/week = score of 1.0
    const maxDownloads = 10_000_000;
    const score = Math.log10(downloads) / Math.log10(maxDownloads);

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Calculate maintenance score based on last update
   * 
   * Packages updated within 12 months get full score (1.0).
   * Older packages get progressively lower scores.
   * 
   * @param lastUpdate - Last update date (ISO 8601 string)
   * @returns Maintenance score (0.0-1.0)
   */
  private calculateMaintenanceScore(lastUpdate?: string): number {
    if (!lastUpdate) {
      return 0.5; // Default score if no update info
    }

    try {
      const updateDate = new Date(lastUpdate);
      const now = new Date();
      const monthsOld = (now.getTime() - updateDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

      // Full score if updated within 12 months
      if (monthsOld <= 12) {
        return 1.0;
      }

      // Decay score for older packages
      // 24 months = 0.5, 36 months = 0.25, etc.
      return Math.max(0.0, 1.0 - (monthsOld - 12) / 24);

    } catch (err) {
      this.log.warn('Invalid date format for lastUpdate', { lastUpdate, error: err });
      return 0.5;
    }
  }

  /**
   * Extract keywords from package name
   * 
   * Splits package name by common separators (-, _, /) and filters out
   * common prefixes/suffixes.
   * 
   * @param packageName - Package name to extract keywords from
   * @returns Array of keywords
   */
  private extractKeywordsFromName(packageName: string): string[] {
    // Split by common separators
    const parts = packageName.toLowerCase().split(/[-_/]/);

    // Filter out common prefixes/suffixes and short words
    const commonWords = new Set(['js', 'ts', 'node', 'npm', 'lib', 'pkg', 'api', 'client', 'server']);
    
    return parts
      .filter(part => part.length > 2 && !commonWords.has(part))
      .map(part => part.trim())
      .filter(part => part.length > 0);
  }

  /**
   * Generate candidate package names based on ghost package
   * 
   * Creates variations of the ghost package name by:
   * - Removing common suffixes (-js, -ts, -client, etc.)
   * - Removing hyphens/underscores
   * - Adding common prefixes (@types/, node-, etc.)
   * 
   * @param ghostPackage - Ghost package name
   * @returns Array of candidate package names
   */
  private generateCandidates(ghostPackage: string): string[] {
    const candidates = new Set<string>();

    // Add the original name
    candidates.add(ghostPackage);

    // Remove common suffixes
    const suffixes = ['-js', '-ts', '-client', '-server', '-api', '-lib', '-pkg', '.js', '.ts'];
    for (const suffix of suffixes) {
      if (ghostPackage.endsWith(suffix)) {
        candidates.add(ghostPackage.slice(0, -suffix.length));
      }
    }

    // Remove hyphens and underscores
    if (ghostPackage.includes('-') || ghostPackage.includes('_')) {
      candidates.add(ghostPackage.replace(/[-_]/g, ''));
    }

    // Try with common prefixes
    const prefixes = ['@types/', 'node-', '@'];
    for (const prefix of prefixes) {
      if (!ghostPackage.startsWith(prefix)) {
        candidates.add(prefix + ghostPackage);
      }
    }

    // Try removing prefixes
    for (const prefix of prefixes) {
      if (ghostPackage.startsWith(prefix)) {
        candidates.add(ghostPackage.slice(prefix.length));
      }
    }

    return Array.from(candidates);
  }

  /**
   * Clear metadata cache
   */
  clearCache(): void {
    this.metadataCache.clear();
    this.log.debug('Cleared metadata cache');
  }
}
