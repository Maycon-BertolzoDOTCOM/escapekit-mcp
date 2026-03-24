# Implementation Plan

## Tasks

- [ ] 1. Refatorar construtor do MockReplacer com injeção de dependências
  - Adicionar interface `MockReplacerDeps` com campos opcionais `knowledgeBase`, `semanticMatcher`, `npmRegistry`
  - Atualizar construtor para aceitar `deps: MockReplacerDeps = {}` e instanciar defaults quando não fornecidos
  - Adicionar imports de `KnowledgeBase`, `SemanticMatcher` e `NPMRegistry`
  - Verificar que `AutoFixEngine` continua funcionando sem alterações (`new MockReplacer()`)
  - Arquivo: `src/validate/auto-fix/MockReplacer.ts`

- [ ] 2. Extrair métodos auxiliares do método `fix` atual
  - Extrair `extractGhostImport(message: string): string | null` com o regex existente
  - Extrair `applyReplacement(projectPath, issue, ghostImport, realPackage, strategy): Promise<Fix>` com a lógica de substituição de texto e chamada a `updatePackageJson`
  - Garantir que o comportamento de substituição (single/double quotes, require/import) seja preservado
  - Arquivo: `src/validate/auto-fix/MockReplacer.ts`

- [ ] 3. Implementar método `resolveReplacement` com a Resolution_Chain
  - Implementar etapa 1: consulta a `KnowledgeBase.getMapping`
  - Implementar etapa 2: consulta a `SemanticMatcher.findSimilar` com try/catch
  - Implementar etapa 3: consulta a `NPMRegistry.packageExists` com try/catch
  - Implementar etapa 4: consulta à tabela hardcoded `replacements`
  - Cada etapa deve logar a estratégia usada conforme especificado nos requisitos
  - Arquivo: `src/validate/auto-fix/MockReplacer.ts`

- [ ] 4. Implementar inicialização lazy da KnowledgeBase
  - Adicionar flag `private kbInitialized = false`
  - Na primeira chamada a `resolveReplacement`, tentar carregar `knowledge-base.json` via `this.knowledgeBase.loadFromFile`
  - Capturar erros de I/O com log `warn` e continuar sem a KnowledgeBase
  - Arquivo: `src/validate/auto-fix/MockReplacer.ts`

- [ ] 5. Atualizar método `fix` para usar os novos métodos
  - Substituir o corpo do método `fix` para usar `extractGhostImport`, `resolveReplacement` e `applyReplacement`
  - Tratar o caso especial `strategy === 'npm-registry-verified'` retornando `applied: false`
  - Manter todas as validações de `issue.file` existentes
  - Arquivo: `src/validate/auto-fix/MockReplacer.ts`

- [ ] 6. Escrever testes unitários para o MockReplacer refatorado
  - Criar `tests/validate/MockReplacer.test.ts`
  - Testar resolução via KnowledgeBase (mock retorna PackageMapping)
  - Testar resolução via SemanticMatcher (KnowledgeBase retorna null, SemanticMatcher retorna resultado)
  - Testar verificação via NPMRegistry (KnowledgeBase e SemanticMatcher sem resultado, packageExists retorna true)
  - Testar fallback hardcoded (todas as estratégias dinâmicas sem resultado)
  - Testar caso sem nenhuma resolução (applied: false, error correto)
  - Testar resiliência a exceções em SemanticMatcher e NPMRegistry
  - Testar round-trip de compatibilidade para os 18 mapeamentos hardcoded

- [ ] 7. Verificar diagnósticos e corrigir erros de tipo
  - Executar `getDiagnostics` em `src/validate/auto-fix/MockReplacer.ts`
  - Corrigir quaisquer erros de tipo TypeScript introduzidos pela refatoração
  - Verificar que `src/validate/auto-fix/AutoFixEngine.ts` não apresenta novos erros
