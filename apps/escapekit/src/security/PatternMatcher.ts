/**
 * PatternMatcher
 * 
 * Detects suspicious code patterns in installation scripts using regex-based heuristics.
 * Identifies network requests, environment variable access, code execution, obfuscation,
 * and file system operations. Also recognizes legitimate build tool patterns to reduce
 * false positives.
 */

import { PatternType, PatternDefinition, DetectedPattern } from './types.js';

/**
 * Suspicious pattern definitions with weights
 * 
 * These patterns are commonly found in supply chain attacks:
 * - Network requests: curl, wget, fetch, axios, http.get
 * - Environment access: AWS_*, GITHUB_TOKEN, NPM_TOKEN, etc.
 * - Code execution: eval, Function, child_process.exec/spawn
 * - Obfuscation: base64, hex encoding
 * - File system: fs.writeFile, fs.appendFile
 */
const SUSPICIOUS_PATTERNS: PatternDefinition[] = [
  // Network Requests (weight: 30)
  {
    type: 'network_request',
    regex: /\b(curl|wget)\s+/gi,
    weight: 30,
  },
  {
    type: 'network_request',
    regex: /\b(fetch|axios|request|http\.get|https\.get)\s*\(/gi,
    weight: 30,
  },
  
  // Environment Variable Access (weight: 40)
  {
    type: 'env_access',
    regex: /process\.env\.(AWS_[A-Z_]+|GITHUB_TOKEN|NPM_TOKEN|DOCKER_|KUBE_|SECRET_|API_KEY|TOKEN)/gi,
    weight: 40,
  },
  
  // Code Execution (weight: 25)
  {
    type: 'code_execution',
    regex: /\b(eval|Function)\s*\(/gi,
    weight: 25,
  },
  {
    type: 'code_execution',
    regex: /child_process\.(exec|spawn|execSync|spawnSync)/gi,
    weight: 25,
  },
  
  // Obfuscation (weight: 20)
  {
    type: 'obfuscation',
    regex: /\b(atob|btoa|Buffer\.from\([^,]+,\s*['"]base64['"]\))/gi,
    weight: 20,
  },
  {
    type: 'obfuscation',
    regex: /\\x[0-9a-fA-F]{2}/g,
    weight: 20,
  },
  
  // File System Operations (weight: 15)
  {
    type: 'file_system',
    regex: /fs\.(writeFile|appendFile|writeFileSync|appendFileSync)/gi,
    weight: 15,
  },

  // Hardcoded Secrets — property names (weight: 50)
  {
    type: 'hardcoded_secret',
    regex: /\b(stripeKey|apiKey|api_key|password|secret|token)\s*:\s*['"][^'"]+['"]/gi,
    weight: 50,
  },
  // Hardcoded Secrets — sk_live_ / sk_test_ prefixes (weight: 50)
  {
    type: 'hardcoded_secret',
    regex: /['"]sk_(live|test)_[^'"]+['"]/gi,
    weight: 50,
  },
];

/**
 * Legitimate pattern whitelist
 * 
 * These patterns indicate legitimate build tools and should reduce false positives:
 * - Build tools: tsc, webpack, rollup, esbuild, vite
 * - Native compilation: node-gyp, prebuild-install
 * - Package managers: npm, yarn, pnpm
 * - Common build scripts: build, compile
 * - Git hooks: husky install
 */
const LEGITIMATE_PATTERNS: RegExp[] = [
  // Build tools
  /\b(tsc|webpack|rollup|esbuild|vite)\b/i,
  
  // Native compilation
  /\bnode-gyp\b/i,
  /\bprebuild-install\b/i,
  
  // Package managers
  /\b(npm|yarn|pnpm)\s+(install|ci)\b/i,
  
  // Common build scripts
  /\bbuild\b/i,
  /\bcompile\b/i,
  
  // Husky git hooks
  /\bhusky\s+install\b/i,
];

/**
 * PatternMatcher class
 * 
 * Detects suspicious patterns in installation scripts and checks against
 * legitimate pattern whitelist.
 */
export class PatternMatcher {
  private patterns: PatternDefinition[];
  private legitimatePatterns: RegExp[];

  constructor() {
    this.patterns = SUSPICIOUS_PATTERNS;
    this.legitimatePatterns = LEGITIMATE_PATTERNS;
  }

  /**
   * Detect all suspicious patterns in a script
   * 
   * @param script - The script content to analyze
   * @returns Array of detected patterns with type, pattern, match, and position
   */
  detectPatterns(script: string): DetectedPattern[] {
    const detected: DetectedPattern[] = [];
    
    for (const patternDef of this.patterns) {
      // Reset regex lastIndex to ensure consistent matching
      patternDef.regex.lastIndex = 0;
      
      let match: RegExpExecArray | null;
      while ((match = patternDef.regex.exec(script)) !== null) {
        // Calculate line and column position
        const position = this.calculatePosition(script, match.index);
        
        detected.push({
          type: patternDef.type,
          pattern: patternDef.regex.source,
          match: match[0],
          position,
        });
      }
    }
    
    return detected;
  }

  /**
   * Check if script contains legitimate build tool patterns
   * 
   * @param script - The script content to check
   * @returns True if legitimate patterns are found
   */
  isLegitimatePattern(script: string): boolean {
    for (const pattern of this.legitimatePatterns) {
      if (pattern.test(script)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get pattern type from a pattern definition
   * 
   * @param pattern - The regex pattern source
   * @returns The pattern type
   */
  getPatternType(pattern: string): PatternType | undefined {
    for (const patternDef of this.patterns) {
      if (patternDef.regex.source === pattern) {
        return patternDef.type;
      }
    }
    return undefined;
  }

  /**
   * Calculate line and column position from string index
   * 
   * @param script - The full script content
   * @param index - The character index in the script
   * @returns Line and column position (1-indexed)
   */
  private calculatePosition(script: string, index: number): { line: number; column: number } {
    const lines = script.substring(0, index).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
    };
  }
}
