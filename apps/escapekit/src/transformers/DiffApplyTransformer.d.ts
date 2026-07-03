/**
 * Diff Apply Transformer - Aplicação de Diffs no estilo Roo Code
 *
 * Este módulo fornece funcionalidades para aplicar, gerar e validar diffs
 * unificados (patch format) no estilo do Roo Code, com suporte a fuzzy matching
 * para lidar com pequenas diferenças no código.
 *
 * @module transformers/DiffApplyTransformer
 */
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
export declare class DiffApplyTransformer {
    private readonly importReplacer;
    constructor();
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
    applyDiff(filePath: string, diffContent: string, options?: DiffApplyOptions): Promise<DiffApplyResult>;
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
    generateDiff(original: string, modified: string): string;
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
    validateDiff(diff: string): boolean;
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
    applyFuzzyDiff(filePath: string, diffContent: string, threshold?: number): Promise<DiffApplyResult>;
    /**
     * Aplica diff ao conteúdo de uma string.
     */
    private applyDiffToContent;
    /**
     * Parse hunks de um diff unificado.
     */
    private parseDiffHunks;
    /**
     * Aplica um hunk a um array de linhas.
     */
    private applyHunk;
    /**
     * Encontra a melhor posição para aplicar um hunk usando fuzzy matching.
     */
    private findBestContextMatch;
    /**
     * Calcula similaridade entre dois conjuntos de linhas.
     */
    private calculateSimilarity;
    /**
     * Calcula distância de Levenshtein entre duas strings.
     */
    private levenshteinDistance;
    /**
     * Aplica hunk em uma posição específica.
     *
     * CORREÇÃO: Esta é a versão corrigida que aplica todos os hunks de forma padronizada.
     * O unified diff especifica: "remova oldCount linhas começando em oldStart e insira newLines"
     */
    private applyHunkAtPosition;
}
//# sourceMappingURL=DiffApplyTransformer.d.ts.map