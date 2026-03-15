/**
 * Diff Apply Transformer - Aplicação de Diffs no estilo Roo Code
 *
 * Este módulo fornece funcionalidades para aplicar, gerar e validar diffs
 * unificados (patch format) no estilo do Roo Code, com suporte a fuzzy matching
 * para lidar com pequenas diferenças no código.
 *
 * @module transformers/DiffApplyTransformer
 */

import * as fs from 'fs/promises';
import { ImportReplacer } from './ImportReplacer.js';
import { TransformationError } from '../errors.js';

/**
 * Opções para aplicação de diff
 */
export interface DiffApplyOptions {
  /** Tolerância para fuzzy matching (0.0 - 1.0) */
  fuzzyThreshold?: number;
  /** Criar backup do arquivo original antes de aplicar */
  backup?: boolean;
  /** Caminho para salvar backup */
  backupPath?: string;
}

/**
 * Resultado da aplicação de diff
 */
export interface DiffApplyResult {
  /** Se o diff foi aplicado com sucesso */
  success: boolean;
  /** Caminho do arquivo modificado */
  filePath: string;
  /** Número de hunks aplicados */
  hunksApplied: number;
  /** Número de hunks que falharam */
  hunksFailed: number;
  /** Linhas alteradas no total */
  linesChanged: number;
  /** Mensagens de erro (se houver) */
  errors?: string[];
  /** Caminho do backup criado (se aplicável) */
  backupPath?: string;
}

/**
 * Estatísticas de similaridade para fuzzy matching
 */
export interface SimilarityStats {
  /** Linhas correspondidas */
  matchedLines: number;
  /** Total de linhas */
  totalLines: number;
  /** Score de similaridade (0.0 - 1.0) */
  similarityScore: number;
}

/**
 * Hunk de diff unificado
 */
interface DiffHunk {
  /** Linha original onde começa o hunk */
  oldStart: number;
  /** Número de linhas originais */
  oldCount: number;
  /** Linha modificada onde começa o hunk */
  newStart: number;
  /** Número de linhas modificadas */
  newCount: number;
  /** Linhas do hunk (prefixadas com ' ', '+', '-') */
  lines: string[];
}

/**
 * DiffApplyTransformer aplica diffs unificados a arquivos.
 *
 * Suporta aplicação de diffs padrão unified diff, geração de diffs
 * entre versões de código, validação de formato de diff, e fuzzy matching
 * para lidar com pequenas diferenças.
 *
 * @example
 * ```typescript
 * const transformer = new DiffApplyTransformer();
 * const result = await transformer.applyDiff(
 *   'src/file.ts',
 *   '--- a/src/file.ts\n+++ b/src/file.ts\n@@ -1 +1 @@\n-old\n+new\n'
 * );
 * ```
 */
export class DiffApplyTransformer {
  private readonly importReplacer: ImportReplacer;

  constructor() {
    this.importReplacer = new ImportReplacer();
  }

  /**
   * Aplica um diff unificado a um arquivo.
   *
   * Lê o arquivo original, aplica o patch unificado, e salva o resultado.
   * Suporta backup automático e tratamento de erros.
   *
   * @param filePath - Caminho do arquivo a modificar
   * @param diffContent - Conteúdo do diff unificado
   * @param options - Opções de aplicação
   * @returns Resultado da aplicação do diff
   * @throws TransformationError se o arquivo não existir ou diff for inválido
   *
   * @example
   * ```typescript
   * const result = await transformer.applyDiff('src/app.ts', diffContent, {
   *   backup: true,
   *   fuzzyThreshold: 0.8
   * });
   * ```
   */
  async applyDiff(
    filePath: string,
    diffContent: string,
    options: DiffApplyOptions = {}
  ): Promise<DiffApplyResult> {
    const {
      fuzzyThreshold = 1.0,
      backup = false,
      backupPath
    } = options;

    // Validar o diff antes de aplicar
    if (!this.validateDiff(diffContent)) {
      throw new TransformationError(
        'Invalid diff format',
        'applyDiff',
        { filePath, diffContent: diffContent.slice(0, 200) }
      );
    }

    // Ler arquivo original
    let originalContent: string;
    try {
      originalContent = await fs.readFile(filePath, 'utf-8');
    } catch (err) {
      throw new TransformationError(
        `Failed to read file: ${(err as Error).message}`,
        'applyDiff',
        { filePath }
      );
    }

    // Criar backup se solicitado
    let actualBackupPath: string | undefined;
    if (backup) {
      actualBackupPath = backupPath || `${filePath}.backup`;
      try {
        await fs.writeFile(actualBackupPath, originalContent, 'utf-8');
      } catch (err) {
        throw new TransformationError(
          `Failed to create backup: ${(err as Error).message}`,
          'applyDiff',
          { filePath, backupPath: actualBackupPath }
        );
      }
    }

    // Aplicar o diff
    const result = this.applyDiffToContent(originalContent, diffContent, fuzzyThreshold);

    // Se houve mudanças, salvar o arquivo
    if (result.linesChanged > 0) {
      try {
        await fs.writeFile(filePath, result.modifiedContent, 'utf-8');
      } catch (err) {
        throw new TransformationError(
          `Failed to write file: ${(err as Error).message}`,
          'applyDiff',
          { filePath }
        );
      }
    }

    return {
      success: result.hunksFailed === 0,
      filePath,
      hunksApplied: result.hunksApplied,
      hunksFailed: result.hunksFailed,
      linesChanged: result.linesChanged,
      errors: result.errors.length > 0 ? result.errors : undefined,
      backupPath: actualBackupPath
    };
  }

  /**
   * Gera um diff unificado entre duas versões de código.
   *
   * Reutiliza a lógica de diff do ImportReplacer para gerar
   * um unified diff padrão.
   *
   * @param original - Código original
   * @param modified - Código modificado
   * @returns Diff unificado em formato string
   *
   * @example
   * ```typescript
   * const diff = transformer.generateDiff(
   *   "import foo from 'old';",
   *   "import foo from 'new';"
   * );
   * ```
   */
  generateDiff(original: string, modified: string): string {
    return this.importReplacer.generateDiff(original, modified);
  }

  /**
   * Valida o formato de um diff unificado.
   *
   * Verifica se o diff segue o formato padrão de unified diff:
   * - Headers --- e +++
   * - Hunk headers @@ -old,+new @@
   * - Linhas prefixadas com ' ', '+', ou '-'
   *
   * @param diff - Conteúdo do diff a validar
   * @returns true se o diff for válido, false caso contrário
   *
   * @example
   * ```typescript
   * const isValid = transformer.validateDiff(
   *   '--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new\n'
   * );
   * ```
   */
  validateDiff(diff: string): boolean {
    if (!diff || diff.trim().length === 0) {
      return false;
    }

    const lines = diff.split('\n');
    let i = 0;

    // Verificar headers
    if (i >= lines.length || !lines[i].startsWith('--- ')) {
      return false;
    }
    i++;

    if (i >= lines.length || !lines[i].startsWith('+++ ')) {
      return false;
    }
    i++;

    // Verificar hunks
    let hasHunk = false;
    while (i < lines.length) {
      const line = lines[i];

      // Pular linhas vazias
      if (line.trim().length === 0) {
        i++;
        continue;
      }

      // Verificar header de hunk
      if (!line.startsWith('@@ ')) {
        return false;
      }

      // Parse hunk header
      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (!hunkMatch) {
        return false;
      }

      hasHunk = true;
      i++;

      // Verificar linhas do hunk
      while (i < lines.length) {
        const hunkLine = lines[i];
        if (hunkLine.startsWith('@@') || hunkLine.startsWith('---') || hunkLine.startsWith('+++')) {
          break;
        }

        // Linha deve começar com ' ', '+', ou '-'
        if (hunkLine.length > 0 && ![' ', '+', '-'].includes(hunkLine[0])) {
          return false;
        }

        i++;
      }
    }

    return hasHunk;
  }

  /**
   * Aplica um diff com fuzzy matching (tolerância a diferenças).
   *
   * Usa algoritmo de similaridade de strings para encontrar a melhor posição
   * para aplicar cada hunk, mesmo que o código original tenha pequenas diferenças.
   *
   * @param filePath - Caminho do arquivo a modificar
   * @param diffContent - Conteúdo do diff unificado
   * @param threshold - Threshold de similaridade (0.0 - 1.0, padrão 0.8)
   * @returns Resultado da aplicação do diff
   *
   * @example
   * ```typescript
   * const result = await transformer.applyFuzzyDiff(
   *   'src/app.ts',
   *   diffContent,
   *   0.85  // 85% de similaridade mínima
   * );
   * ```
   */
  async applyFuzzyDiff(
    filePath: string,
    diffContent: string,
    threshold: number = 0.8
  ): Promise<DiffApplyResult> {
    return this.applyDiff(filePath, diffContent, {
      fuzzyThreshold: Math.max(0.0, Math.min(1.0, threshold))
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Aplica diff ao conteúdo de uma string.
   */
  private applyDiffToContent(
    originalContent: string,
    diffContent: string,
    fuzzyThreshold: number
  ): {
    modifiedContent: string;
    hunksApplied: number;
    hunksFailed: number;
    linesChanged: number;
    errors: string[];
  } {
    const originalLines = originalContent.split('\n');
    const modifiedLines = [...originalLines];

    const hunks = this.parseDiffHunks(diffContent);
    const errors: string[] = [];
    let hunksApplied = 0;
    let hunksFailed = 0;
    let totalLinesChanged = 0;

    // Ordenar hunks em ordem reversa para evitar problemas de índice
    // (ao aplicar hunks, linhas são inseridas/removidas, afetando índices posteriores)
    const sortedHunks = hunks.sort((a, b) => b.oldStart - a.oldStart);

    for (const hunk of sortedHunks) {
      const applyResult = this.applyHunk(
        modifiedLines,
        hunk,
        fuzzyThreshold
      );

      if (applyResult.success) {
        hunksApplied++;
        totalLinesChanged += applyResult.linesChanged;
      } else {
        hunksFailed++;
        if (applyResult.error) {
          errors.push(applyResult.error);
        }
      }
    }

    return {
      modifiedContent: modifiedLines.join('\n'),
      hunksApplied,
      hunksFailed,
      linesChanged: totalLinesChanged,
      errors
    };
  }

  /**
   * Parse hunks de um diff unificado.
   */
  private parseDiffHunks(diffContent: string): DiffHunk[] {
    const lines = diffContent.split('\n');
    const hunks: DiffHunk[] = [];
    let i = 0;

    // Pular headers
    while (i < lines.length && (lines[i].startsWith('---') || lines[i].startsWith('+++'))) {
      i++;
    }

    // Parse hunks
    while (i < lines.length) {
      const line = lines[i];

      // Pular linhas vazias
      if (line.trim().length === 0) {
        i++;
        continue;
      }

      // Parse header de hunk
      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (!hunkMatch) {
        break;
      }

      const oldStart = parseInt(hunkMatch[1], 10);
      const oldCount = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;
      const newStart = parseInt(hunkMatch[3], 10);
      const newCount = hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1;

      const hunkLines: string[] = [];
      i++;

      // Parse linhas do hunk
      while (i < lines.length) {
        const hunkLine = lines[i];
        if (hunkLine.startsWith('@@') || hunkLine.startsWith('---') || hunkLine.startsWith('+++')) {
          break;
        }

        if (hunkLine.length > 0) {
          hunkLines.push(hunkLine);
        }
        i++;
      }

      hunks.push({
        oldStart,
        oldCount,
        newStart,
        newCount,
        lines: hunkLines
      });
    }

    return hunks;
  }

  /**
   * Aplica um hunk a um array de linhas.
   */
  private applyHunk(
    lines: string[],
    hunk: DiffHunk,
    fuzzyThreshold: number
  ): { success: boolean; linesChanged: number; error?: string } {
    // Para fuzzy matching, buscar melhor posição
    if (fuzzyThreshold < 1.0) {
      // Construir linha de contexto para busca
      const contextLines = hunk.lines
        .filter(line => line.startsWith(' '))
        .map(line => line.slice(1));
      
      if (contextLines.length > 0) {
        const bestMatch = this.findBestContextMatch(lines, contextLines, fuzzyThreshold);
        if (bestMatch !== null) {
          return this.applyHunkAtPosition(lines, bestMatch, hunk.lines);
        }
      }
    }

    // Aplicar sem fuzzy matching (posição original)
    return this.applyHunkAtPosition(lines, hunk.oldStart - 1, hunk.lines);
  }

  /**
   * Encontra a melhor posição para aplicar um hunk usando fuzzy matching.
   */
  private findBestContextMatch(
    lines: string[],
    contextLines: string[],
    threshold: number
  ): number | null {
    let bestPosition = -1;
    let bestScore = 0;

    // Buscar contexto em janelas deslizantes
    for (let i = 0; i <= lines.length - contextLines.length; i++) {
      const window = lines.slice(i, i + contextLines.length);
      const stats = this.calculateSimilarity(contextLines, window);

      if (stats.similarityScore >= threshold && stats.similarityScore > bestScore) {
        bestScore = stats.similarityScore;
        bestPosition = i;
      }
    }

    return bestPosition >= 0 ? bestPosition : null;
  }

  /**
   * Calcula similaridade entre dois conjuntos de linhas.
   */
  private calculateSimilarity(lines1: string[], lines2: string[]): SimilarityStats {
    if (lines1.length !== lines2.length) {
      return {
        matchedLines: 0,
        totalLines: Math.max(lines1.length, lines2.length),
        similarityScore: 0
      };
    }

    let matches = 0;
    for (let i = 0; i < lines1.length; i++) {
      if (lines1[i] === lines2[i]) {
        matches++;
      } else {
        // Similaridade por Levenshtein
        const dist = this.levenshteinDistance(lines1[i], lines2[i]);
        const maxLength = Math.max(lines1[i].length, lines2[i].length);
        if (maxLength > 0 && dist / maxLength <= 0.3) {
          matches++;
        }
      }
    }

    return {
      matchedLines: matches,
      totalLines: lines1.length,
      similarityScore: lines1.length > 0 ? matches / lines1.length : 1.0
    };
  }

  /**
   * Calcula distância de Levenshtein entre duas strings.
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(
            dp[i - 1][j],
            dp[i][j - 1],
            dp[i - 1][j - 1]
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Aplica hunk em uma posição específica.
   * 
   * CORREÇÃO: Esta é a versão corrigida que aplica todos os hunks de forma padronizada.
   * O unified diff especifica: "remova oldCount linhas começando em oldStart e insira newLines"
   */
  private applyHunkAtPosition(
    lines: string[],
    position: number,
    hunkLines: string[]
  ): { success: boolean; linesChanged: number } {
    // Verificar bounds
    if (position < 0 || position > lines.length) {
      return { success: false, linesChanged: 0 };
    }

    // Processar linhas do hunk em ordem
    // O formato unified diff tem: contexto, linhas removidas, linhas adicionadas
    // Precisamos verificar se o conteúdo atual corresponde ao que deve ser removido
    
    let lineOffset = 0;
    let linesToRemove: number[] = [];  // índices das linhas para remover
    let linesToAdd: string[] = [];     // linhas para adicionar

    for (let i = 0; i < hunkLines.length; i++) {
      const hunkLine = hunkLines[i];
      const prefix = hunkLine[0];
      const content = hunkLine.slice(1);

      if (prefix === ' ') {
        // Linha de contexto - deve corresponder
        const actualLine = lines[position + lineOffset];
        if (actualLine !== content) {
          // Mismatch - aplicar fuzzy matching
          const dist = this.levenshteinDistance(actualLine, content);
          const maxLength = Math.max(actualLine.length, content.length);
          const similarity = maxLength > 0 ? 1 - dist / maxLength : 1.0;
          if (similarity < 0.7) {
            return { success: false, linesChanged: 0 };
          }
        }
        lineOffset++;
      } else if (prefix === '-') {
        // Linha para remover
        linesToRemove.push(position + lineOffset);
        lineOffset++;
      } else if (prefix === '+') {
        // Linha para adicionar
        linesToAdd.push(content);
      }
    }

    // Remover linhas (em ordem reversa para não afetar índices)
    const sortedToRemove = linesToRemove.sort((a, b) => b - a);
    for (const idx of sortedToRemove) {
      lines.splice(idx, 1);
    }

    // Adicionar novas linhas
    if (linesToAdd.length > 0) {
      // Achar posição correta para inserir (após o contexto e linhas removidas)
      // A posição é a posição original do hunk, ajustada pelo contexto já consumido
      const contextConsumed = hunkLines.filter(line => line.startsWith(' ')).length;
      const removedConsumed = linesToRemove.length;
      const insertPosition = position + contextConsumed - removedConsumed;
      
      lines.splice(insertPosition, 0, ...linesToAdd);
    }

    return {
      success: true,
      linesChanged: linesToRemove.length + linesToAdd.length
    };
  }
}
