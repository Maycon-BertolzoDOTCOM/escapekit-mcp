/**
 * SlopsquatDetector
 * 
 * Detects slopsquatting and AI package hallucinations based on USENIX 2025 research.
 * Analyzes package names for high entropy, extreme compound structures, overly 
 * generic naming patterns, and visual similarity to popular packages (typosquatting).
 */

import { Issue, generateId } from '../models/schemas.js';

import { logger } from '../logger.js';
import { PackageMetadata } from './types.js';

export interface SlopsquatOptions {
  /** Maximum allowable Levenshtein distance for typosquat check (default: 2) */
  maxDistance?: number;
  /** Maximum allowable entropy score (default: 4.5) */
  maxEntropy?: number;
}

export class SlopsquatDetector {
  private readonly log = logger.child('SlopsquatDetector');
  
  // A small sample of highly targeted npm packages for typosquatting checks
  // In a full implementation, this would be a dynamic top-1000 list
  private readonly popularPackages = [
    'react', 'express', 'axios', 'lodash', 'typescript', 'webpack', 
    'jest', 'mongoose', 'moment', 'chalk', 'commander', 'vue',
    'eslint', 'prettier', 'rxjs', 'next', 'nuxt', 'tailwindcss'
  ];

  // Common AI hallucination suffixes
  private readonly hallucinatedSuffixes = [
    '-pro', '-advanced', '-plus', '-enterprise', '-helper', '-utils',
    '-manager', '-service', '-client', '-api', '-toolkit', '-core',
    '-extended', '-premium'
  ];

  // Common frameworks often hallucinated as prefixes
  private readonly proxyPrefixes = [
    'react-', 'vue-', 'angular-', 'node-', 'express-', 'nestjs-'
  ];

  constructor(
    private readonly options: SlopsquatOptions = {}
  ) {
    this.options.maxDistance = this.options.maxDistance ?? 2;
    this.options.maxEntropy = this.options.maxEntropy ?? 4.5;
  }

  /**
   * Analyze a package name for slopsquatting risk
   * @param packageName The name of the package to analyze
   * @param metadata Optional metadata from the registry
   */
  async analyze(packageName: string, metadata?: PackageMetadata): Promise<Issue | null> {
    this.log.debug(`Analyzing package "${packageName}" for slopsquatting risk`);

    const risks: string[] = [];

    // 1. Typosquat Check (Levenshtein distance to popular packages)
    const typoTarget = this.findTyposquatTarget(packageName);
    if (typoTarget && typoTarget !== packageName) {
      risks.push(`Name is suspiciously similar to popular package "${typoTarget}" (typosquatting risk).`);
    }

    // 2. Hallucination Pattern Check
    if (this.matchesHallucinationPattern(packageName)) {
      risks.push('Name strongly matches AI code hallucination patterns (e.g., highly compound, overly generic/descriptive).');
    }

    // 3. Entropy Check
    const entropy = this.calculateShannonEntropy(packageName);
    if (this.options.maxEntropy !== undefined && entropy > this.options.maxEntropy) {
      risks.push(`High name entropy (${entropy.toFixed(2)}), suggesting auto-generated or obfuscated naming.`);
    }

    // 4. Recency & Legitimacy Check (if metadata provided)
    if (metadata?.publishDate) {
      const daysSincePublish = (Date.now() - metadata.publishDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePublish < 30 && risks.length > 0) {
        risks.push(`Package was published very recently (${Math.floor(daysSincePublish)} days ago), increasing slopsquatting probability.`);
      }
    }

    // Determine if it's an issue
    if (risks.length > 0) {
      // If it's just a pattern match but no typosquatting, it might be a valid generic name
      // We only flag as Warning if multiple risks overlap or if typosquatting / high entropy is found
      const isHighRisk = typoTarget || (this.options.maxEntropy !== undefined && entropy > this.options.maxEntropy) || risks.length > 1 || this.matchesHallucinationPattern(packageName);
      
      if (isHighRisk) {
        return {
          id: generateId('issue_slopsquat'),
          type: 'slopsquat_risk',
          detector: 'SlopsquatDetector',
          severity: typoTarget ? 'error' : 'warning',
          location: { file: 'package.json', line: 0, column: 0 },
          message: `Package "${packageName}" flagged as potential Slopsquatting / AI Hallucination`,
          description: `Analysis revealed the following risks:\n- ${risks.join('\n- ')}`,
          suggestion: 'Verify this package exists legitimately on the npm registry and is the exact tool you intend to use. AI assistants frequently hallucinate generic package names that attackers later register to distribute malware.',
          autoFixable: false,
        };
      }
    }

    return null;
  }

  /**
   * Checks if name matches common hallucinated structures
   */
  matchesHallucinationPattern(packageName: string): boolean {
    const lowerName = packageName.toLowerCase();

    // Check for extreme compound names (e.g., react-awesome-slider-pro-utils)
    const parts = lowerName.split('-');
    if (parts.length >= 4) {
      return true;
    }

    // Check for generic suffix overuse
    const hasHallucinatedSuffix = this.hallucinatedSuffixes.some(s => lowerName.endsWith(s));
    const hasProxyPrefix = this.proxyPrefixes.some(p => lowerName.startsWith(p));

    if (hasProxyPrefix && hasHallucinatedSuffix && parts.length >= 3) {
      return true;
    }

    // Highly generic AI combinations
    if (lowerName === 'http-client' || lowerName === 'node-database' || lowerName === 'ai-api-client') {
      return true;
    }

    return false;
  }

  /**
   * Finds if a name is suspiciously close to a popular package
   */
  findTyposquatTarget(packageName: string): string | null {
    const lowerName = packageName.toLowerCase();
    
    // Exact match to popular package is safe
    if (this.popularPackages.includes(lowerName)) {
      return null;
    }

    for (const popular of this.popularPackages) {
      // Don't flag completely different lengths
      if (Math.abs(popular.length - lowerName.length) > 2) continue;

      const distance = this.levenshtein(lowerName, popular);
      
      // If it's 1 edit away, it's highly likely a typosquat (e.g. 'lodsh' vs 'lodash')
      if (distance > 0 && this.options.maxDistance !== undefined && distance <= this.options.maxDistance) {
        // Exception: react-dom, react-native shouldn't trigger 'react' distance
        if (lowerName.startsWith(popular + '-')) continue;
        
        return popular;
      }
    }

    return null;
  }

  /**
   * Calculates Shannon entropy of a string to detect random character spam
   */
  calculateShannonEntropy(str: string): number {
    if (str.length === 0) return 0;
    
    const charCounts = new Map<string, number>();
    for (const char of str) {
      charCounts.set(char, (charCounts.get(char) || 0) + 1);
    }

    let entropy = 0;
    for (const count of charCounts.values()) {
      const p = count / str.length;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Standard Levenshtein distance
   */
  private levenshtein(a: string, b: string): number {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[b.length][a.length];
  }
}
