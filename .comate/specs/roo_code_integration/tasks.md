# Plano de Tarefas: Integração do Roo Code (diff-based editing)

- [x] Tarefa 1: Criar DiffApplyTransformer no módulo transformers
    - 1.1: Implementar classe DiffApplyTransformer com estrutura básica em src/transformers/DiffApplyTransformer.ts
    - 1.2: Implementar método applyDiff(filePath: string, diffContent: string): Promise<boolean> para ler arquivo, aplicar patch unificado e salvar resultado
    - 1.3: Implementar método generateDiff(original: string, modified: string): string reutilizando lógica de diff existente
    - 1.4: Implementar método validateDiff(diff: string): boolean para validar formato de unified diff
    - 1.5: Implementar método applyFuzzyDiff(filePath: string, diffContent: string, threshold: number): Promise<boolean> com algoritmo de similaridade
    - 1.6: Atualizar src/transformers/index.ts para exportar DiffApplyTransformer

- [x] Tarefa 2: Criar testes unitários para DiffApplyTransformer
    - 2.1: Criar arquivo tests/transformers/DiffApplyTransformer.test.ts
    - 2.2: Implementar testes para validateDiff() com diffs válidos e inválidos
    - 2.3: Implementar testes para applyDiff() com cenários básicos (adicionar/remover/linhas)
    - 2.4: Implementar testes para applyDiff() com múltiplos hunks
    - 2.5: Implementar testes para applyFuzzyDiff() com diferentes thresholds de similaridade
    - 2.6: Implementar testes de preservação de formatação
    - 2.7: Implementar testes de tratamento de erros (arquivos inexistentes, diffs malformados)

- [x] Tarefa 3: Integrar DiffApplyTransformer no pipeline de transformação
    - 3.1: Analisar src/generators/TransformationPipeline.ts para identificar ponto de integração
    - 3.2: Modificar TransformationPipeline para incluir etapa de aplicação de diff após ImportReplacer
    - 3.3: Adicionar suporte a diffs fornecidos pelo usuário
    - 3.4: Atualizar interface CodeTransformation em src/models/transformation.ts para incluir diffs aplicados

- [x] Tarefa 4: Atualizar modelos de dados para suportar diffs
    - 4.1: Revisar interface EscapeContract em src/models/transformation.ts
    - 4.2: Adicionar campo para registrar diffs aplicados em transformations
    - 4.3: Adicionar metadados de fuzzy matching quando aplicável

- [x] Tarefa 5: Criar comandos CLI para manipulação de diffs
    - 5.1: Criar módulo qwen-escapekit/src/commands/diff.ts com comandos diff
    - 5.2: Implementar comando 'diff apply <filePath> <diffFile>'
    - 5.3: Implementar comando 'diff generate <originalFile> <modifiedFile>'
    - 5.4: Implementar comando 'diff validate <diffFile>'
    - 5.5: Adicionar opções para fuzzy matching (--fuzzy <threshold>)
    - 5.6: Atualizar qwen-escapekit/src/index.ts para registrar novos comandos (pendente - necessidade de correção manual devido a problemas de encoding)

- [x] Tarefa 6: Criar testes de integração
    - 6.1: Criar arquivo tests/integration/roo-code-integration.test.ts
    - 6.2: Implementar teste end-to-end de aplicação de diff via CLI
    - 6.3: Implementar teste de integração no pipeline completo (analyze → transform com diff)
    - 6.4: Implementar teste de geração de EscapeContract com diffs aplicados

- [x] Tarefa 7: Criar documentação da integração
    - 7.1: Criar arquivo docs/roo-code-integration.md com documentação completa
    - 7.2: Documentar API do DiffApplyTransformer com exemplos de uso
    - 7.3: Documentar comandos CLI com exemplos práticos
    - 7.4: Atualizar README.md principal com seção sobre Roo Code
    - 7.5: Criar guias de troubleshooting para problemas comuns

- [x] Tarefa 8: Validar cobertura de testes e qualidade
    - 8.1: Executar suíte de testes completa para garantir zero regressões ✅
    - 8.2: Verificar cobertura de código para novos componentes (meta: 90%+) ⚠️ (55.55% para DiffApplyTransformer - abaixo da meta, mas funcional)
    - 8.3: Executar lint e typecheck ✅
    - 8.4: Validar que todos os testes existentes continuam passando ✅

- [x] Tarefa 9: Melhorar cobertura de testes e resolver pendências imediatas ✅
    - 9.1: Adicionar testes unitários para métodos privados do DiffApplyTransformer ✅ (33 testes, 94.46% de cobertura)
    - 9.2: Adicionar testes de casos de borda (falhas de diff, fallbacks, diffs com múltiplos hunks) ✅ (incluídos nos 33 testes)
    - 9.3: Corrigir encoding nos READMEs e documentação (usar iconv se necessário) ✅ (todos arquivos já em UTF-8)
    - 9.4: Verificar registro CLI no package.json bin ✅ (comando diff registrado em qwen-escapekit/src/index.ts)
    - 9.5: Validar comando qwen-escapekit disponível globalmente ✅ (subcomandos apply, generate, validate funcionando)

- [x] Tarefa 10.1: Criar CHANGELOG entry para nova funcionalidade ✅
- [x] Tarefa 10.2: Atualizar README.md principal com seção Roo Code ✅
- [x] Tarefa 10.3: Criar docs/roo-code-integration.md com guia completo ✅
- [x] Tarefa 10.4: Criar exemplos em examples/roo-code-integration/ ✅
- [ ] Tarefa 10.5: Atualizar JSDoc e gerar TypeDoc (Semana 1)
- [x] Tarefa 10.6: Criar MIGRATION.md e CONTRIBUTING.md atualizado ✅
- [ ] Tarefa 10.7: Preparar release v2.0.0 (Semana 3)

## Semana 3 - Release MVP ✅

- [x] Tarefa 11.1: Bump version para 2.0.0 (package.json e qwen-escapekit/package.json) ✅
- [x] Tarefa 11.2: Gerar build e rodar testes (npm run build, npm test, npm run typecheck, npm run lint) ✅
- [x] Tarefa 11.3: Preparar GitHub Release (GITHUB_RELEASE_NOTES.md criado) ✅
- [x] Tarefa 11.4: Preparar npm publish (build gerado, testes passando, pronto para publish) ✅
- [x] Tarefa 11.5: Preparar announcement (estratégia definida para GitHub, Twitter, Discord, Reddit) ✅

