# Fix CI Test Failures and Lint Warnings

## Tasks

### Task 1: Corrigir a execução dos testes no CI
- [x] 1.1 Editar `.github/workflows/ci.yml` e substituir `npm run test:coverage` por `npm run test:ci`
- [x] 1.2 Criar um novo script no `package.json` chamado `test:ci` com o comando `vitest --run --coverage`
- [x] 1.3 Manter o script `test` original como `vitest` (modo watch) para desenvolvimento local
- [x] 1.4 Atualizar os jobs do CI que usam `npm test` para usar `npm run test:ci`
- [x] 1.5 Verificar localmente: `npm run test:ci` executa os testes uma vez e gera cobertura

### Task 2: Corrigir os 6 testes quebrados (adapters e E2EValidator)
- [x] 2.1 Corrigir normalização de nomes em `src/adapters/custom-parser.ts`, `jest-adapter.ts`, `mocha-adapter.ts`, `playwright-adapter.ts`
- [x] 2.2 Ajustar o teste `custom-parser.test.ts` (linha 40)
- [x] 2.3 Aumentar timeout no teste `E2EValidator.test.ts` (linha 18) para 10000ms
- [x] 2.4 Executar `npm run test:ci` e confirmar que todos os 1282 testes passam

### Task 3: Eliminar os 133 warnings de lint
- [ ] 3.1 Gerar um spec detalhado para os warnings
- [ ] 3.2 Executar as correções com CodeBuddy
- [ ] 3.3 Verificar redução de warnings após cada grupo de arquivos
- [ ] 3.4 Adicionar `--max-warnings 0` ao script `lint`
- [ ] 3.5 Atualizar o workflow CI para usar `--max-warnings 0`