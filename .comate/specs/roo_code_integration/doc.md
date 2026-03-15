# Documento de Requisitos: Integração do Roo Code (diff-based editing)

## Contexto

O projeto EscapeKit MCP é uma ferramenta que converte código gerado em ambientes de IA (sandboxes) para ambientes de produção. O usuário solicitou uma análise de viabilidade para integrar o **Roo Code**, um sistema de edição baseado em diffs, ao ecossistema EscapeKit.

## Análise de Viabilidade

### Status do Projeto EscapeKit

Baseado na análise do código-fonte e documentação:

1. **Arquitetura do Transformation Engine (Fase 3 - COMPLETA)**
   - Camada 3 (Transformation): `src/transformers/` - Contém `ASTTransformer` e `ImportReplacer`
   - Já utiliza AST + Babel + recast para manipulação de código
   - Gera unified diffs via `ImportReplacer.generateDiff()`

2. **Capacidades Atuais**
   - `ASTTransformer`: Parsing e geração de código com preservação de formatação
   - `ImportReplacer`: Substituição de imports via AST com geração de diff
   - Algoritmo LCS (Longest Common Subsequence) já implementado para diff

3. **Testes Existentes**
   - `tests/transformers/ImportReplacer.test.ts`: 447 linhas de testes
   - Cobertura de transformações, validação de sintaxe, preservação de formatação
   - Testes para geração de diffs unificados

### Avaliação da Integração Roo Code

**Conclusão: O projeto JÁ ESTÁ na fase de integração adequada para implementar diff-based editing do Roo Code.**

#### Motivos:

1. **Infraestrutura AST Madura**
   - O `ASTTransformer` já implementa parsing via Babel e geração via recast
   - Suporta ES6, CommonJS, dynamic imports e TypeScript
   - Preservação de formatação já testada

2. **Algoritmo de Diff Presente**
   - `ImportReplacer.computeEdits()` implementa algoritmo Myers-like via LCS
   - Gera unified diffs com headers (`---`, `+++`, `@@`)
   - Suporta context lines e hunks

3. **Arquitetura Modular**
   - `src/transformers/` isolado em Camada 3
   - Interface `CodeTransformation` já contempla `metadata.diff`
   - Export via `src/transformers/index.ts` bem definido

4. **Ferramentas CLI Disponíveis**
   - `qwen-escapekit` CLI já existe e está funcionando
   - Pode ser estendido para gerar planos de integração
   - Comandos `paper`, `list`, `implement`, `validate` funcionais

5. **Testes Automatizados**
   - Vitest configurado
   - 70+ testes unitários com ~85% de cobertura
   - Framework pronto para adicionar testes de fuzzy matching

## Plano de Integração Proposto

### Fase 1: Extensão do Transformer

**Objetivo**: Criar um novo transformer especializado em aplicar diffs do Roo Code.

**Arquivos a criar/modificar**:
- `src/transformers/DiffApplyTransformer.ts` (NOVO)
- `src/transformers/index.ts` (MODIFICAR - exportar nova classe)

**Funcionalidades**:
1. `applyDiff(filePath: string, diffContent: string): Promise<boolean>`
   - Lê arquivo original
   - Aplica patch unificado usando algoritmo de diff
   - Salva resultado com preservação de formatação
   
2. `generateDiff(original: string, modified: string): string`
   - Reutilizar ou extender `ImportReplacer.generateDiff()`
   - Adicionar suporte a fuzzy matching
   
3. `validateDiff(diff: string): boolean`
   - Valida formato do unified diff
   - Verifica sintaxe dos hunks

4. `applyFuzzyDiff(filePath: string, diffContent: string, threshold: number): Promise<boolean>`
   - Aplica diff com tolerância a pequenas diferenças
   - Usa algoritmo de similaridade de strings

### Fase 2: Integração no Pipeline de Transformação

**Objetivo**: Integrar o `DiffApplyTransformer` no pipeline existente.

**Arquivos a modificar**:
- `src/generators/TransformationPipeline.ts` (MODIFICAR)
- `src/models/transformation.ts` (MODIFICAR - adicionar novos tipos)

**Alterações**:
1. Adicionar etapa de aplicação de diff após `ImportReplacer`
2. Suportar diffs fornecidos pelo usuário ou gerados automaticamente
3. Atualizar `EscapeContract` para registrar diffs aplicados

### Fase 3: CLI e Comandos Auxiliares

**Objetivo**: Expor funcionalidades via CLI.

**Arquivos a criar/modificar**:
- `qwen-escapekit/src/commands/diff.ts` (NOVO)
- `qwen-escapekit/src/index.ts` (MODIFICAR)

**Novos comandos**:
```bash
# Aplicar diff a um arquivo
qwen-escapekit diff apply <filePath> <diffFile>

# Gerar diff entre dois arquivos
qwen-escapekit diff generate <originalFile> <modifiedFile>

# Validar formato de diff
qwen-escapekit diff validate <diffFile>
```

### Fase 4: Testes e Validação

**Objetivo**: Garantir robustez da integração.

**Arquivos a criar**:
- `tests/transformers/DiffApplyTransformer.test.ts` (NOVO)
- `tests/integration/roo-code-integration.test.ts` (NOVO)

**Cenários de teste**:
1. Diffs válidos e inválidos
2. Aplicação de múltiplos diffs consecutivos
3. Fuzzy matching com ruído no código
4. Preservação de formatação
5. Tratamento de conflitos

### Fase 5: Documentação

**Objetivo**: Documentar uso da integração.

**Arquivos a criar**:
- `docs/roo-code-integration.md` (NOVO)
- Atualizar `README.md` com seção sobre Roo Code

**Conteúdo**:
1. Guia de uso da API do `DiffApplyTransformer`
2. Exemplos de comandos CLI
3. Casos de uso típicos
4. Troubleshooting

## Benefícios da Integração

1. **Economia de Tokens**
   - Diffs são mais concisos que código completo
   - Reduz tamanho de prompts para IA

2. **Rastreabilidade**
   - Diffs documentam mudanças explicitamente
   - Facilita audit e revert

3. **Flexibilidade**
   - Suporta patches manuais
   - Permite versionar transformações

4. **Compatibilidade**
   - Padrão unified diff é amplamente suportado
   - Integra com ferramentas como git, patch, etc.

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Conflitos ao aplicar diffs | Média | Alto | Implementar merge strategy + fallback manual |
| Fuzzy matching incorreto | Média | Médio | Testes extensivos + threshold configurável |
| Preservação de formatação | Baixa | Baixo | Já existe infraestrutura via recast |
| Performance com arquivos grandes | Baixa | Médio | Streaming + lazy loading |

## Próximos Passos

1. Confirmar viabilidade com usuário
2. Priorizar implementação por fases
3. Começar pela Fase 1 (DiffApplyTransformer)
4. Iterar com testes contínuos

## Métricas de Sucesso

- [ ] `DiffApplyTransformer` implementado com todos os métodos
- [ ] 90%+ de cobertura de testes para novo código
- [ ] CLI funcional com comandos `diff apply/generate/validate`
- [ ] Integração completa no pipeline de transformação
- [ ] Documentação completa (API + CLI + guias)
- [ ] Zero regressões nos testes existentes