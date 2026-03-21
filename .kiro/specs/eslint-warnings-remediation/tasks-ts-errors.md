# TypeScript Errors Remediation — Tasks (42 erros)

## Contexto

Erros identificados via `npx tsc --noEmit`. Todos os erros são de tipagem estrita (`strict: true`):
- `error: unknown` em catch blocks acessado sem type guard
- `KiwiRawResult[key]: unknown` acessado como tipo concreto
- `res.statusCode: number | undefined` comparado sem nullish coalescing
- `child.pid: number | undefined` usado sem verificação
- Tipos DOM (`Window`, `HTMLCanvasElement`) não disponíveis em contexto Node.js

---

## Task List

- [ ] 1. Fix `src/adapters/vitest-adapter.ts` (1 erro)
  - [ ] 1.1 Linha 108: substituir `error.message` por `error instanceof Error ? error.message : String(error)` no catch block (seguir padrão já existente na linha ~120 do mesmo arquivo)
  - [ ] 1.2 Executar `npx tsc --noEmit` e confirmar zero erros em `src/adapters/vitest-adapter.ts`

- [ ] 2. Fix `src/lib/kiwi-client.ts` (14 erros)
  - [ ] 2.1 Adicionar campos tipados em `KiwiRawResult`: expandir a interface para incluir `name?: string; summary?: string; product?: number; id?: number` mantendo `[key: string]: unknown`
  - [ ] 2.2 `listBuilds` linha ~370: garantir que `b.name` seja acessado via campo tipado da interface `KiwiRawResult` ou usar `String(b.name)`
  - [ ] 2.3 `createBuild` linha ~382: garantir que `result.name` seja acessado via campo tipado ou usar `String(result.name)`
  - [ ] 2.4 `getOrCreateBuild` linha ~395: garantir que `existing.name` seja acessado via campo tipado ou usar `String(existing.name)`
  - [ ] 2.5 `listProducts` linha ~415: garantir que `p.name` seja acessado via campo tipado ou usar `String(p.name)`
  - [ ] 2.6 `listCategories` linha ~440: garantir que `c.name` e `c.product` sejam acessados via campos tipados ou usar `String(c.name)` e `Number(c.product)`
  - [ ] 2.7 `getStatusMap` linha ~465: garantir que `s.name` seja acessado via campo tipado para que `.toLowerCase()` seja válido
  - [ ] 2.8 `findTestCase` linha ~225: garantir que `results[0].summary` seja acessado via campo tipado
  - [ ] 2.9 `createTestCase` linha ~240: garantir que `result.summary` seja acessado via campo tipado
  - [ ] 2.10 `createTestRun` linha ~280: garantir que `result.summary` seja acessado via campo tipado
  - [ ] 2.11 `validateProduct` linha ~260: garantir que `p.name` seja acessado via campo tipado
  - [ ] 2.12 `validateCategory` linha ~275: garantir que `c.name` seja acessado via campo tipado
  - [ ] 2.13 `addTestExecution` linha ~300 e ~305: substituir `error?.message` e `error.message` por type guard `error instanceof Error ? error.message : String(error)` no catch block
  - [ ] 2.14 Executar `npx tsc --noEmit` e confirmar zero erros em `src/lib/kiwi-client.ts`

- [ ] 3. Fix `src/lib/retry.ts` (8 erros)
  - [ ] 3.1 Definir interface `AxiosLikeError { response?: { status?: number; headers?: Record<string, string> }; headers?: Record<string, string>; message?: string }` no topo do arquivo
  - [ ] 3.2 Definir type guard `function isAxiosLikeError(e: unknown): e is AxiosLikeError { return typeof e === 'object' && e !== null }`
  - [ ] 3.3 `getRetryAfterDelay` linhas ~75-90: envolver acessos a `error?.response?.headers` e `error?.headers` com `isAxiosLikeError(error)` antes de acessar as propriedades
  - [ ] 3.4 `isRetryableError`: envolver acessos a `error?.response?.status` e `error.message` com `isAxiosLikeError(error)` antes de acessar
  - [ ] 3.5 `isNonRetryableError`: envolver acessos a `error.message` e `error?.response?.status` com `isAxiosLikeError(error)` antes de acessar
  - [ ] 3.6 `execute` método: mudar `catch (error: any)` para `catch (error: unknown)` e usar type guard nos acessos subsequentes
  - [ ] 3.7 Executar `npx tsc --noEmit` e confirmar zero erros em `src/lib/retry.ts`

- [ ] 4. Fix `src/lib/notifications.ts` (2 erros)
  - [ ] 4.1 Revisar a definição de `SlackElement` — o tipo atual não inclui propriedades `text`, `url`, `style` que são usadas nos `blocks.push`
  - [ ] 4.2 Mudar o campo `elements` em `SlackBlock` de `elements: SlackElement[]` para `elements: SlackAccessory[]`, pois os elementos dentro de blocos `actions` são sempre do tipo `SlackAccessory` (que já possui `text`, `url`, `style`)
  - [ ] 4.3 Executar `npx tsc --noEmit` e confirmar zero erros em `src/lib/notifications.ts`

- [ ] 5. Fix `src/lib/test-parser.ts` (4 erros)
  - [ ] 5.1 Adicionar type guard `function isRawResult(r: unknown): r is { name: string; status: string; duration?: number; error?: string }` antes do `.map()`
  - [ ] 5.2 Linha ~8: usar o type guard antes de acessar `result.name`
  - [ ] 5.3 Linha ~9: usar o type guard antes de acessar `result.status`
  - [ ] 5.4 Linha ~10: usar o type guard antes de acessar `result.duration`
  - [ ] 5.5 Linha ~11: usar o type guard antes de acessar `result.error`
  - [ ] 5.6 Executar `npx tsc --noEmit` e confirmar zero erros em `src/lib/test-parser.ts`

- [ ] 6. Fix `src/server.ts` (2 erros)
  - [ ] 6.1 Linha ~53: substituir `tool.execute(params)` por `tool.execute(params as MCPParams)` ou adicionar type guard verificando que `params` satisfaz `MCPParams` antes da chamada
  - [ ] 6.2 Linha ~120: substituir `generateEscapeKit(analysis_result, ...)` por `generateEscapeKit(analysis_result as AnalysisResult, ...)` — verificar o tipo exato que `generateEscapeKit` espera e garantir que o cast é seguro
  - [ ] 6.3 Executar `npx tsc --noEmit` e confirmar zero erros em `src/server.ts`

- [ ] 7. Fix `src/validate/environments/DockerEnvironment.ts` (3 erros)
  - [ ] 7.1 `fetchWithTimeout` método, linha ~230: substituir `res.statusCode >= 200` por `(res.statusCode ?? 0) >= 200` para lidar com `number | undefined`
  - [ ] 7.2 Mesma linha: substituir `res.statusCode < 400` por `(res.statusCode ?? 0) < 400`
  - [ ] 7.3 No objeto de retorno: substituir `status: res.statusCode` por `status: res.statusCode ?? 0`
  - [ ] 7.4 Executar `npx tsc --noEmit` e confirmar zero erros em `src/validate/environments/DockerEnvironment.ts`

- [ ] 8. Fix `src/validate/environments/LocalEnvironment.ts` (3 erros)
  - [ ] 8.1 `fetchWithTimeout` método: substituir `res.statusCode >= 200` por `(res.statusCode ?? 0) >= 200`
  - [ ] 8.2 Mesma linha: substituir `res.statusCode < 400` por `(res.statusCode ?? 0) < 400`
  - [ ] 8.3 No objeto de retorno: substituir `status: res.statusCode` por `status: res.statusCode ?? 0`
  - [ ] 8.4 Executar `npx tsc --noEmit` e confirmar zero erros em `src/validate/environments/LocalEnvironment.ts`

- [ ] 9. Fix `src/validate/validators/BuildValidator.ts` (1 erro)
  - [ ] 9.1 `cleanupProcess` método, linha ~280: substituir `process.kill(-child.pid)` por verificação explícita `if (child.pid !== undefined) process.kill(-child.pid)` antes de usar o valor
  - [ ] 9.2 Executar `npx tsc --noEmit` e confirmar zero erros em `src/validate/validators/BuildValidator.ts`

- [ ] 10. Fix `src/validate/validators/DependencyValidator.ts` (2 erros)
  - [ ] 10.1 `runNpmAudit` método: substituir `vuln.severity || 'moderate'` por `(vuln.severity as 'critical' | 'high' | 'moderate' | 'low') || 'moderate'` — ou validar com `['critical', 'high', 'moderate', 'low'].includes(vuln.severity ?? '') ? vuln.severity as 'critical' | 'high' | 'moderate' | 'low' : 'moderate'`
  - [ ] 10.2 `vuln.via?.[0]` acesso: substituir por `typeof vuln.via?.[0] === 'string' ? vuln.via[0] : vuln.via?.[0]?.title || 'Unknown vulnerability'` para lidar com o tipo `string | { title?: string; url?: string }`
  - [ ] 10.3 Executar `npx tsc --noEmit` e confirmar zero erros em `src/validate/validators/DependencyValidator.ts`

- [ ] 11. Fix `src/validate/validators/WebGLValidator.ts` (3 erros)
  - [ ] 11.1 Substituir `(globalThis as Window).document` por `(globalThis as unknown as { document: Document }).document` nos callbacks de `page.evaluate()` — ou adicionar `"dom"` ao array `lib` no `tsconfig.json`
  - [ ] 11.2 Substituir `Array.from(doc.querySelectorAll('canvas')) as HTMLCanvasElement[]` por cast via `unknown`: `Array.from(doc.querySelectorAll('canvas')) as unknown as HTMLCanvasElement[]` — ou adicionar `"dom"` ao `tsconfig.json`
  - [ ] 11.3 Se optar por adicionar `"dom"` ao `tsconfig.json`: verificar que não quebra outros arquivos que dependem de tipos Node.js puros
  - [ ] 11.4 Executar `npx tsc --noEmit` e confirmar zero erros em `src/validate/validators/WebGLValidator.ts`

- [ ] 12. Fix `src/validators/E2EValidator.ts` (3 erros)
  - [ ] 12.1 Substituir `(globalThis as Window).document` por `(globalThis as unknown as { document: { querySelectorAll: (s: string) => ArrayLike<{ tagName: string }> } }).document` nos callbacks de `page.evaluate()`
  - [ ] 12.2 Substituir referências a `HTMLCanvasElement` por cast via `unknown` ou usar o mesmo approach do `tsconfig.json` adotado em `WebGLValidator.ts`
  - [ ] 12.3 Executar `npx tsc --noEmit` e confirmar zero erros em `src/validators/E2EValidator.ts`

- [ ] 13. Verificação final
  - [ ] 13.1 Executar `npx tsc --noEmit` e confirmar zero erros em todos os arquivos
  - [ ] 13.2 Executar `npm run lint` e confirmar que o número de warnings não aumentou em relação ao baseline
  - [ ] 13.3 Executar `npm test -- --run` e confirmar que todos os testes passam
