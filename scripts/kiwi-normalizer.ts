/**
 * Utilitários de normalização de nomes de teste
 * Mantém consistência entre adapters e upload script
 */

// Mapeamento de priority do Kiwi TCMS
export const PRIORITY_MAP: Record<string, number> = {
  P1: 1,
  P2: 2,
  P3: 3,
  P4: 4,
  P5: 5,
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
  lowest: 5,
};

// Mapeamento de status do Kiwi TCMS
export const STATUS_MAP: Record<string, number> = {
  PROPOSED: 1,
  CONFIRMED: 2,
  DISABLED: 3,
  VERIFIED: 4,
  INVALID: 5,
  passed: 2, // PASSED
  failed: 3, // FAILED
  skipped: 1, // IDLE
  pending: 1, // IDLE
  todo: 1, // IDLE
};

// Normalizer estilo Vitest
export function normalizeVitest(name: string, filepath?: string): string {
  const normalized = name
    .replace(/[\s\(\)\[\]]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  let filepathPrefix = '';
  if (filepath) {
    filepathPrefix = filepath
      .replace(/^.*[\\/]/, '')
      .replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/i, '')
      .replace(/\.(ts|tsx|js|jsx)$/, '')
      .toLowerCase();
    filepathPrefix = `${filepathPrefix}-`;
  }

  return `${filepathPrefix}${normalized}`;
}

// Normalizer estilo Mocha
export function normalizeMocha(name: string, classname?: string): string {
  const prefix = classname ? classname.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() + '-' : '';

  return (prefix + name)
    .replace(/[\s\(\)\[\]]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

// Normalizer genérico
export function normalizeGeneric(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\s\(\)\[\]]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

// Normalizer simples (para o script de upload)
export function normalizeTestName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

// Parsear priority de tags ou metadata
export function parsePriority(testName: string, metadata?: any): number {
  // Verificar se há priority na metadata
  if (metadata?.priority) {
    const priority = String(metadata.priority).toUpperCase();
    if (PRIORITY_MAP[priority]) {
      return PRIORITY_MAP[priority];
    }
  }

  // Procurar por tags no nome do teste
  const priorityMatch = testName.match(/\[(P[1-5]|critical|high|medium|low|lowest)\]/i);
  if (priorityMatch) {
    const priority = priorityMatch[1].toUpperCase();
    return PRIORITY_MAP[priority] || 1;
  }

  // Padrão: P1
  return 1;
}

// Parsear status
export function parseStatus(outcome: string): number {
  return STATUS_MAP[outcome.toLowerCase()] || STATUS_MAP['skipped'];
}

// Detectar framework pelo formato do arquivo
export interface FileAnalysis {
  framework: 'vitest' | 'jest' | 'mocha' | 'playwright' | 'cypress' | 'custom';
  isValid: boolean;
}

export function analyzeTestFile(content: string): FileAnalysis {
  try {
    const data = JSON.parse(content);

    // Vitest
    if (data.numTotalTestSuites !== undefined && data.testResults !== undefined) {
      return { framework: 'vitest', isValid: true };
    }

    // Jest
    if (
      data.numTotalTests !== undefined &&
      data.testResults !== undefined &&
      data.snapshot !== undefined
    ) {
      return { framework: 'jest', isValid: true };
    }

    // Mocha
    if (data.stats !== undefined && (data.failures !== undefined || data.passes !== undefined)) {
      return { framework: 'mocha', isValid: true };
    }

    // Playwright
    if (data.suites !== undefined || data.config !== undefined) {
      return { framework: 'playwright', isValid: true };
    }

    // Cypress
    if (data.browserName !== undefined || data.results !== undefined) {
      return { framework: 'cypress', isValid: true };
    }

    // Custom array format
    if (Array.isArray(data) && data[0]?.testCase !== undefined) {
      return { framework: 'custom', isValid: true };
    }
  } catch {
    // Not JSON
  }

  return { framework: 'custom', isValid: false };
}
