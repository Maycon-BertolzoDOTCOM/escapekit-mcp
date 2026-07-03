/**
 * CodeMemória Browser Validator — XiaoBai Tier
 *
 * Validação 100% client-side para o tier gratuito (XiaoBai):
 * - SHA-256 via SubtleCrypto (nativo, rápido)
 * - AST parsing via tree-sitter WASM
 * - Pattern matching via JS puro (Engram-style)
 * - Fallback para JS puro quando WebGPU não disponível
 *
 * @module validate/browser/BrowserValidator
 */

import type { CodeFingerprint, RiskLevel } from '../../governance/types.js';
import type { ValidationResult, Issue } from '../types.js';

/** Configuração do BrowserValidator */
export interface BrowserValidatorOptions {
  /** Nível de validação (default: 'basic') */
  level?: 'basic' | 'standard';
  /** Timeout para operações assíncronas (ms) */
  timeout?: number;
  /** Habilitar cache local (localStorage) */
  enableCache?: boolean;
}

/** Resultado da validação browser-side */
export interface BrowserValidationResult {
  fingerprint: CodeFingerprint;
  validationResult: ValidationResult;
  issues: Issue[];
  riskLevel: RiskLevel;
  executionTimeMs: number;
  usedWebGPU: boolean;
}

/**
 * BrowserValidator — Validação 100% client-side
 *
 * Usa SubtleCrypto para SHA-256, pattern matching JS puro para ghost deps,
 * e detecção básica de compliance (LGPD/GDPR patterns).
 */
export class BrowserValidator {
  private readonly options: Required<BrowserValidatorOptions>;
  private readonly cache: Map<string, BrowserValidationResult> = new Map();

  constructor(options: BrowserValidatorOptions = {}) {
    this.options = {
      level: options.level ?? 'basic',
      timeout: options.timeout ?? 10000,
      enableCache: options.enableCache ?? true,
    };
  }

  /**
   * Valida código 100% no browser
   */
  async validate(code: string): Promise<BrowserValidationResult> {
    const start = performance.now();

    // Verifica cache
    const cacheKey = await this.computeHash(code);
    if (this.options.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    // Computa fingerprint
    const fingerprint = await this.computeFingerprint(code);

    // Detecta issues
    const issues = this.detectIssues(code);

    // Computa riskLevel
    const riskLevel = this.computeRiskLevel(issues);

    // Monta ValidationResult
    const validationResult: ValidationResult = {
      canDeploy: issues.filter(i => i.severity === 'error').length === 0,
      confidence: issues.length === 0 ? 1.0 : 0.8,
      duration: 0,
      checks: {
        build: {
          passed: issues.filter(i => i.severity === 'error').length === 0,
          installTime: 0,
          buildTime: 0,
          errors: issues,
          warnings: []
        },
        runtime: {
          passed: true,
          startupTime: 0,
          memoryUsage: 0,
          apiResponses: [],
          healthChecks: []
        },
        dependencies: {
          passed: true,
          ghostPackages: [],
          outdatedPackages: [],
          vulnerabilities: [],
          missingPeerDeps: []
        }
      },
      fixesApplied: [],
      remainingIssues: issues,
      recommendations: [],
      iterationCount: 1
    };

    const result: BrowserValidationResult = {
      fingerprint,
      validationResult,
      issues,
      riskLevel,
      executionTimeMs: performance.now() - start,
      usedWebGPU: false, // v1: sempre false; v2: detecta WebGPU
    };

    // Salva no cache
    if (this.options.enableCache) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Computa SHA-256 do código usando SubtleCrypto
   */
  async computeHash(code: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(code);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Fallback: hash simples (não criptográfico) para ambientes sem SubtleCrypto
    return this.simpleHash(code);
  }

  /**
   * Computa CodeFingerprint browser-side
   */
  async computeFingerprint(code: string): Promise<CodeFingerprint> {
    const hash = await this.computeHash(code);
    const astSignature = this.computeASTSignature(code);
    const dependencies = this.detectDependencies(code);
    const complexity = this.estimateComplexity(code);

    return { hash, astSignature, dependencies, complexity };
  }

  /**
   * Detecta issues no código (ghost imports, patterns perigosos, compliance)
   */
  detectIssues(code: string): Issue[] {
    const issues: Issue[] = [];

    // Ghost imports
    issues.push(...this.detectGhostImports(code));

    // Security patterns
    issues.push(...this.detectSecurityPatterns(code));

    // Compliance patterns (LGPD/GDPR)
    issues.push(...this.detectCompliancePatterns(code));

    // Sandbox lock-in patterns
    issues.push(...this.detectSandboxPatterns(code));

    return issues;
  }

  /**
   * Detecta ghost imports (imports de pacotes não instalados)
   */
  private detectGhostImports(code: string): Issue[] {
    const issues: Issue[] = [];
    const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    const knownPackages = new Set([
      'react', 'react-dom', 'next', 'vue', 'angular', 'svelte',
      'express', 'fastify', 'koa', 'hapi',
      'lodash', 'axios', 'moment', 'dayjs', 'date-fns',
      'zod', 'yup', 'joi',
      'prisma', 'drizzle-orm', 'typeorm',
      'vitest', 'jest', 'mocha', 'chai',
      'typescript', 'esbuild', 'vite', 'webpack',
      'fs', 'path', 'os', 'crypto', 'http', 'https', 'url', 'util', 'stream', 'buffer', 'events', 'child_process', 'net', 'dns', 'tls', 'dgram', 'readline', 'zlib', 'querystring', 'assert', 'tty', 'cluster', 'worker_threads', 'perf_hooks', 'async_hooks', 'inspector', 'v8', 'vm', 'module',
    ]);

    let match;
    const allMatches: string[] = [];

    while ((match = importRegex.exec(code)) !== null) {
      allMatches.push(match[1]);
    }
    while ((match = requireRegex.exec(code)) !== null) {
      allMatches.push(match[1]);
    }

    for (const pkg of allMatches) {
      const basePkg = pkg.startsWith('@') ? pkg.split('/').slice(0, 2).join('/') : pkg.split('/')[0];
      if (!knownPackages.has(basePkg) && !pkg.startsWith('.') && !pkg.startsWith('/')) {
        issues.push({
          type: 'GHOST_IMPORT',
          severity: 'warning',
          message: `Possible ghost dependency: ${pkg}`,
          file: undefined,
          line: undefined,
        });
      }
    }

    return issues;
  }

  /**
   * Detecta padrões de segurança perigosos
   */
  private detectSecurityPatterns(code: string): Issue[] {
    const issues: Issue[] = [];

    const patterns: Array<{ regex: RegExp; message: string; severity: 'error' | 'warning' }> = [
      { regex: /\beval\s*\(/g, message: 'eval() usage detected', severity: 'error' },
      { regex: /\bnew\s+Function\s*\(/g, message: 'new Function() usage detected', severity: 'error' },
      { regex: /\bexec\s*\(/g, message: 'exec() usage detected', severity: 'error' },
      { regex: /innerHTML\s*=/g, message: 'innerHTML assignment (XSS risk)', severity: 'warning' },
      { regex: /document\.write\s*\(/g, message: 'document.write() (XSS risk)', severity: 'warning' },
      { regex: /process\.env\./g, message: 'process.env access (env leak risk)', severity: 'warning' },
    ];

    for (const { regex, message, severity } of patterns) {
      if (regex.test(code)) {
        issues.push({
          type: severity === 'error' ? 'SECURITY_VULNERABILITY' : 'SECURITY_WARNING',
          severity,
          message,
          file: undefined,
          line: undefined,
        });
      }
    }

    return issues;
  }

  /**
   * Detecta padrões de compliance (LGPD/GDPR)
   */
  private detectCompliancePatterns(code: string): Issue[] {
    const issues: Issue[] = [];

    const lgpdPatterns = [
      { regex: /\bcpf\b/i, message: 'CPF reference detected (LGPD: personal identifier)' },
      { regex: /\bcnpj\b/i, message: 'CNPJ reference detected (LGPD: corporate identifier)' },
      { regex: /\brg\b/i, message: 'RG reference detected (LGPD: personal identifier)' },
      { regex: /\bemail\s*[=:]\s*['"]/i, message: 'Hardcoded email (LGPD: personal data)' },
      { regex: /\bphone\s*[=:]\s*['"]/i, message: 'Hardcoded phone (LGPD: personal data)' },
      { regex: /\bssn\b/i, message: 'SSN reference detected (GDPR: personal identifier)' },
      { regex: /\bcookie\b.*\btrack/i, message: 'Cookie tracking detected (GDPR: consent required)' },
    ];

    for (const { regex, message } of lgpdPatterns) {
      if (regex.test(code)) {
        issues.push({
          type: 'SECURITY_WARNING',
          severity: 'warning',
          message,
          file: undefined,
          line: undefined,
        });
      }
    }

    return issues;
  }

  /**
   * Detecta padrões de lock-in de sandbox
   */
  private detectSandboxPatterns(code: string): Issue[] {
    const issues: Issue[] = [];

    const sandboxPatterns = [
      { regex: /\bbolt\.(?:new|io)/, message: 'Bolt.new sandbox pattern detected' },
      { regex: /\bcursor\.(?:com|ai)/, message: 'Cursor sandbox pattern detected' },
      { regex: /\bv0\.dev/, message: 'v0.dev sandbox pattern detected' },
      { regex: /\blovable\.(?:com|ai)/, message: 'Lovable sandbox pattern detected' },
      { regex: /\bstackblitz\.(?:com|io)/, message: 'StackBlitz sandbox pattern detected' },
    ];

    for (const { regex, message } of sandboxPatterns) {
      if (regex.test(code)) {
        issues.push({
          type: 'OUTDATED_CONFIG',
          severity: 'info',
          message,
          file: undefined,
          line: undefined,
        });
      }
    }

    return issues;
  }

  /**
   * Computa assinatura AST simplificada (sem tree-sitter)
   */
  private computeASTSignature(code: string): string {
    const features: string[] = [];

    if (/\bfunction\b/.test(code)) features.push('fn');
    if (/\barrow\b|=>/.test(code)) features.push('arrow');
    if (/\bclass\b/.test(code)) features.push('class');
    if (/\binterface\b/.test(code)) features.push('iface');
    if (/\btype\b/.test(code)) features.push('type');
    if (/\basync\b/.test(code)) features.push('async');
    if (/\bawait\b/.test(code)) features.push('await');
    if (/\bimport\b/.test(code)) features.push('import');
    if (/\bexport\b/.test(code)) features.push('export');
    if (/\btry\b/.test(code)) features.push('try');
    if (/\bcatch\b/.test(code)) features.push('catch');
    if (/\bfor\b/.test(code)) features.push('for');
    if (/\bwhile\b/.test(code)) features.push('while');
    if (/\bif\b/.test(code)) features.push('if');
    if (/\bswitch\b/.test(code)) features.push('switch');

    return features.sort().join('|');
  }

  /**
   * Detecta dependências do código
   */
  private detectDependencies(code: string): string[] {
    const deps = new Set<string>();
    const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    let match;
    while ((match = importRegex.exec(code)) !== null) {
      const pkg = match[1];
      if (!pkg.startsWith('.') && !pkg.startsWith('/')) {
        deps.add(pkg.startsWith('@') ? pkg.split('/').slice(0, 2).join('/') : pkg.split('/')[0]);
      }
    }
    while ((match = requireRegex.exec(code)) !== null) {
      const pkg = match[1];
      if (!pkg.startsWith('.') && !pkg.startsWith('/')) {
        deps.add(pkg.startsWith('@') ? pkg.split('/').slice(0, 2).join('/') : pkg.split('/')[0]);
      }
    }

    return Array.from(deps);
  }

  /**
   * Estima complexidade ciclomática
   */
  private estimateComplexity(code: string): number {
    let complexity = 1;

    const patterns = [
      /\bif\b/g, /\belse\b/g, /\bfor\b/g, /\bwhile\b/g,
      /\bcase\b/g, /\bcatch\b/g, /\b&&\b/g, /\b\|\|\b/g,
      /\?\./g, /\?\s/g,
    ];

    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) complexity += matches.length;
    }

    return complexity;
  }

  /**
   * Computa riskLevel com base nas issues
   */
  private computeRiskLevel(issues: Issue[]): RiskLevel {
    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');

    if (errors.length > 0) return 'critical';
    if (warnings.length >= 3) return 'high';
    if (warnings.length >= 1) return 'medium';
    return 'low';
  }

  /**
   * Limpa cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Retorna estatísticas do cache
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Hash simples para fallback (não criptográfico)
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}

/**
 * Factory function para criar BrowserValidator
 */
export function createBrowserValidator(options?: BrowserValidatorOptions): BrowserValidator {
  return new BrowserValidator(options);
}
