import type { CodeFingerprint } from '../types.js';
import { sha256 } from './hash.js';

/** Palavras-chave estruturais usadas para gerar a astSignature */
const STRUCTURAL_KEYWORDS = [
  'function',
  'class',
  'import',
  'export',
  'const',
  'let',
  'var',
  'async',
  'await',
  'return',
  'interface',
  'type',
  'enum',
] as const;

/** Padrões que contribuem para a complexidade ciclomática */
const COMPLEXITY_PATTERNS: RegExp[] = [
  /\bif\b/g,
  /\belse\b/g,
  /\bfor\b/g,
  /\bwhile\b/g,
  /\bswitch\b/g,
  /\bcatch\b/g,
  /&&/g,
  /\|\|/g,
  /\?/g,
];

/**
 * Extrai dependências de `import ... from '...'` e `require('...')`.
 */
function extractDependencies(code: string): string[] {
  const deps = new Set<string>();

  // import ... from '...' ou "..."
  const importFrom = /\bimport\b[^'"]*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = importFrom.exec(code)) !== null) {
    deps.add(m[1]);
  }

  // require('...') ou require("...")
  const requireCall = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = requireCall.exec(code)) !== null) {
    deps.add(m[1]);
  }

  return Array.from(deps);
}

/**
 * Gera uma assinatura estrutural simplificada contando ocorrências de
 * palavras-chave relevantes no código.
 */
function buildAstSignature(code: string): string {
  return STRUCTURAL_KEYWORDS
    .map((kw) => {
      const re = new RegExp(`\\b${kw}\\b`, 'g');
      const count = (code.match(re) ?? []).length;
      return `${kw}:${count}`;
    })
    .join(',');
}

/**
 * Estima a complexidade ciclomática contando estruturas de controle.
 */
function estimateComplexity(code: string): number {
  return COMPLEXITY_PATTERNS.reduce((acc, pattern) => {
    // Cria nova instância para resetar lastIndex
    const re = new RegExp(pattern.source, 'g');
    return acc + (code.match(re) ?? []).length;
  }, 0);
}

/**
 * Computa o fingerprint de um trecho de código.
 */
export function computeFingerprint(code: string): CodeFingerprint {
  return {
    hash: sha256(code),
    astSignature: buildAstSignature(code),
    dependencies: extractDependencies(code),
    complexity: estimateComplexity(code),
  };
}

/**
 * Calcula a similaridade entre dois CodeFingerprints.
 *
 * Fórmula: (hashMatch + jaccardDeps + complexityScore) / 3
 *
 * - hashMatch: 1.0 se hashes iguais, 0.0 caso contrário
 * - jaccardDeps: |A ∩ B| / |A ∪ B| (0 se ambos vazios)
 * - complexityScore: 1 - |a.complexity - b.complexity| / max(a.complexity, b.complexity, 1)
 *
 * Retorna valor em [0, 1].
 */
export function computeSimilarity(a: CodeFingerprint, b: CodeFingerprint): number {
  const hashMatch = a.hash === b.hash ? 1.0 : 0.0;

  const setA = new Set(a.dependencies);
  const setB = new Set(b.dependencies);
  const intersection = a.dependencies.filter((d) => setB.has(d)).length;
  const union = new Set([...setA, ...setB]).size;
  const jaccardDeps = union === 0 ? 0.0 : intersection / union;

  const complexityScore =
    1 - Math.abs(a.complexity - b.complexity) / Math.max(a.complexity, b.complexity, 1);

  return (hashMatch + jaccardDeps + complexityScore) / 3;
}
