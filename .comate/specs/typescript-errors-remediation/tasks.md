# TypeScript Errors Remediation - Tasks

- [x] 1. Fix `src/adapters/vitest-adapter.ts`
    - 1.1: Substituir `error.message` por type guard no catch block
    - 1.2: Verificar com `npx tsc --noEmit`

- [x] 2. Fix `src/lib/kiwi-client.ts`
    - 2.1: Expandir interface `KiwiRawResult`
    - 2.2-2.13: Corrigir acessos a propriedades com type guards
    - 2.14: Verificar com `npx tsc --noEmit`

- [x] 3. Fix `src/lib/retry.ts`
    - 3.1: Definir interface `AxiosLikeError`
    - 3.2: Criar type guard `isAxiosLikeError`
    - 3.3-3.6: Aplicar type guards nos acessos
    - 3.7: Verificar com `npx tsc --noEmit`

- [x] 4. Fix `src/lib/notifications.ts`
    - 4.1: Revisar definição de `SlackElement`
    - 4.2: Atualizar tipo de `elements` em `SlackBlock`
    - 4.3: Verificar com `npx tsc --noEmit`

- [ ] 5. Fix `src/lib/test-parser.ts`
    - 5.1: Adicionar type guard `isRawResult`
    - 5.2-5.5: Aplicar type guards nos acessos
    - 5.6: Verificar com `npx tsc --noEmit`

- [ ] 6. Fix `src/server.ts`
    - 6.1: Adicionar type guard para `params`
    - 6.2: Adicionar type guard para `analysis_result`
    - 6.3: Verificar com `npx tsc --noEmit`

- [ ] 7. Fix `src/validate/environments/DockerEnvironment.ts`
    - 7.1-7.3: Adicionar nullish coalescing para `statusCode`
    - 7.4: Verificar com `npx tsc --noEmit`

- [ ] 8. Fix `src/validate/environments/LocalEnvironment.ts`
    - 8.1-8.3: Adicionar nullish coalescing para `statusCode`
    - 8.4: Verificar com `npx tsc --noEmit`

- [ ] 9. Fix `src/validate/validators/BuildValidator.ts`
    - 9.1: Verificar `child.pid` antes de usar
    - 9.2: Verificar com `npx tsc --noEmit`

- [ ] 10. Fix `src/validate/validators/DependencyValidator.ts`
    - 10.1-10.2: Adicionar verificações de tipo para `severity` e `via`
    - 10.3: Verificar com `npx tsc --noEmit`

- [ ] 11. Fix `src/validate/validators/WebGLValidator.ts`
    - 11.1-11.3: Corrigir tipos DOM ou adicionar ao `tsconfig.json`
    - 11.4: Verificar com `npx tsc --noEmit`

- [ ] 12. Fix `src/validators/E2EValidator.ts`
    - 12.1-12.2: Corrigir tipos DOM
    - 12.3: Verificar com `npx tsc --noEmit`

- [ ] 13. Verificação final
    - 13.1: Executar `npx tsc --noEmit` em todos os arquivos
    - 13.2: Executar `npm run lint`
    - 13.3: Executar `npm test -- --run`