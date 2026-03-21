# ESLint Warnings Remediation — Tasks (111 warnings)

## Task List

- [ ] 1. Exploratory: confirmar estado atual
  - [ ] 1.1 Executar `npm run lint 2>&1 | tee /tmp/lint-before.txt` e confirmar 111 warnings antes de qualquer mudança
  - [ ] 1.2 Executar `npm run lint -- --max-warnings 0` e confirmar saída com código não-zero

- [ ] 2. Fix `src/adapters/custom-parser.ts` (2 warnings — `no-useless-escape`)
  - [ ] 2.1 Linha 186: remover `\` desnecessário em `\[` dentro da regex → usar `[` diretamente
  - [ ] 2.2 Linha 193: remover `\` desnecessário em `\[` dentro da regex → usar `[` diretamente
  - [ ] 2.3 Executar `eslint src/adapters/custom-parser.ts` e confirmar zero warnings

- [ ] 3. Fix `src/adapters/cypress-adapter.ts` (4 warnings — `no-useless-escape`)
  - [ ] 3.1 Linha 169: remover `\(`, `\)`, `\[` desnecessários na regex → usar `(`, `)`, `[`
  - [ ] 3.2 Linha 176: remover `\[` desnecessário na regex → usar `[`
  - [ ] 3.3 Executar `eslint src/adapters/cypress-adapter.ts` e confirmar zero warnings

- [ ] 4. Fix `src/adapters/jest-adapter.ts` (4 warnings — `no-useless-escape`)
  - [ ] 4.1 Linha 155: remover `\(`, `\)`, `\[` desnecessários na regex → usar `(`, `)`, `[`
  - [ ] 4.2 Linha 162: remover `\[` desnecessário na regex → usar `[`
  - [ ] 4.3 Executar `eslint src/adapters/jest-adapter.ts` e confirmar zero warnings

- [ ] 5. Fix `src/adapters/mocha-adapter.ts` (7 warnings — `no-useless-escape` + `no-control-regex`)
  - [ ] 5.1 Linha 195: remover `\(`, `\)`, `\[` desnecessários na regex
  - [ ] 5.2 Linha 202: remover `\(`, `\)`, `\[` desnecessários na regex
  - [ ] 5.3 Linha 211: substituir `\x1b` no regex por uma variável string ou usar `// eslint-disable-next-line no-control-regex` com comentário justificando (ANSI strip intencional)
  - [ ] 5.4 Executar `eslint src/adapters/mocha-adapter.ts` e confirmar zero warnings

- [ ] 6. Fix `src/adapters/playwright-adapter.ts` (9 warnings — `no-explicit-any` + `no-useless-escape` + `no-control-regex`)
  - [ ] 6.1 Linha 27: substituir `any` no tipo de `errors` em `PlaywrightTestResult` por `PlaywrightError[]` onde `interface PlaywrightError { message: string; stack?: string }`
  - [ ] 6.2 Linha 41: substituir `any` no tipo de `config` em `PlaywrightOutput` por `Record<string, unknown>`
  - [ ] 6.3 Linha 43: substituir `any` no tipo de `errors` em `PlaywrightOutput` por `PlaywrightError[]`
  - [ ] 6.4 Linhas 160, 167: remover `\(`, `\)`, `\[` desnecessários nas regexes
  - [ ] 6.5 Linha 176: substituir `\x1b` no regex por `// eslint-disable-next-line no-control-regex` com comentário justificando
  - [ ] 6.6 Executar `eslint src/adapters/playwright-adapter.ts` e confirmar zero warnings

- [ ] 7. Fix `src/adapters/vitest-adapter.ts` (12 warnings — `no-explicit-any` + `no-non-null-assertion` + `no-useless-escape` + `no-control-regex`)
  - [ ] 7.1 Linha 44: substituir `meta?: any` em `VitestAssertionResult` por `meta?: Record<string, unknown>`
  - [ ] 7.2 Linha 106: substituir `error: any` no catch de `load()` por `error: unknown` e usar `error instanceof Error ? error.message : String(error)` nos acessos
  - [ ] 7.3 Linhas 208, 209: substituir `result!.state` e `result!.duration` por `result?.state ?? 'run'` e `result?.duration ?? 0` em `parseTestResult`
  - [ ] 7.4 Linhas 221, 222: substituir `result!.state` e `result!.error` por optional chaining com fallback
  - [ ] 7.5 Linha 226: substituir `result!.state` por `result?.state`
  - [ ] 7.6 Linha 227: substituir `result!.error.message` por `result?.error?.message ?? ''`
  - [ ] 7.7 Linha 232: substituir `result!.error.stack` por `result?.error?.stack ?? ''`
  - [ ] 7.8 Linha 258: remover `\(`, `\)`, `\[` desnecessários na regex
  - [ ] 7.9 Linha 279: substituir `\x1b` no regex por `// eslint-disable-next-line no-control-regex` com comentário justificando (strip ANSI intencional)
  - [ ] 7.10 Executar `eslint src/adapters/vitest-adapter.ts` e confirmar zero warnings

- [ ] 8. Fix `src/generators/TemplateEngine.ts` (2 warnings — `no-non-null-assertion`)
  - [ ] 8.1 Linha 153: substituir `!` por optional chaining ou guard `if (!value) return ''`
  - [ ] 8.2 Linha 299: substituir `!` por optional chaining com fallback `?? ''`
  - [ ] 8.3 Executar `eslint src/generators/TemplateEngine.ts` e confirmar zero warnings

- [ ] 9. Fix `src/lib/kiwi-client.ts` (20 warnings — `no-explicit-any` + `no-non-null-assertion`)
  - [ ] 9.1 Linha 167: substituir `params?: any` em `jsonrpc<T>()` por `params?: unknown[] | Record<string, unknown>`
  - [ ] 9.2 Linha 229: substituir `jsonrpc<any[]>` por `jsonrpc<KiwiRawResult[]>` onde `interface KiwiRawResult { id: number; summary?: string; name?: string; [key: string]: unknown }`
  - [ ] 9.3 Linha 244: substituir `jsonrpc<any>` por `jsonrpc<KiwiRawResult>`
  - [ ] 9.4 Linha 279: substituir `products.find(...)!` por `products.find(...) ?? (() => { throw new Error(...) })()`  ou reestruturar com guard
  - [ ] 9.5 Linha 300: substituir `categories.find(...)!` com o mesmo padrão de guard
  - [ ] 9.6 Linhas 321, 332, 338, 346, 370, 384, 395, 409, 416, 433, 457, 469, 482, 490, 503: substituir `jsonrpc<any>` e `jsonrpc<any[]>` por `jsonrpc<KiwiRawResult>` e `jsonrpc<KiwiRawResult[]>` respectivamente, usando `KiwiRawResult` para acessar campos via index signature
  - [ ] 9.7 Executar `eslint src/lib/kiwi-client.ts` e confirmar zero warnings

- [ ] 10. Fix `src/lib/logger.ts` (4 warnings — `no-explicit-any`)
  - [ ] 10.1 Linhas 27, 31, 35, 39: substituir `...args: any[]` por `...args: unknown[]` nos métodos `debug`, `info`, `warn`, `error`
  - [ ] 10.2 Executar `eslint src/lib/logger.ts` e confirmar zero warnings

- [ ] 11. Fix `src/lib/notifications.ts` (10 warnings — `no-explicit-any`)
  - [ ] 11.1 Linha 54: substituir `any[]` no tipo de `blocks` por `SlackBlock[]` onde `interface SlackBlock { type: string; text?: { type: string; text: string }; [key: string]: unknown }`
  - [ ] 11.2 Linhas 98, 113, 145, 161, 267, 275, 279, 291, 322: substituir `any` por `unknown` ou pelo tipo específico do contexto (payloads de Slack/Jira são `Record<string, unknown>`)
  - [ ] 11.3 Executar `eslint src/lib/notifications.ts` e confirmar zero warnings

- [ ] 12. Fix `src/lib/retry.ts` (5 warnings — `no-explicit-any`)
  - [ ] 12.1 Linha 81: substituir `any` no tipo de retorno ou parâmetro por `unknown`
  - [ ] 12.2 Linhas 140, 152, 170, 175: substituir `any` por `unknown` nos tipos de erro/resultado; usar `error instanceof Error ? error.message : String(error)` nos acessos
  - [ ] 12.3 Executar `eslint src/lib/retry.ts` e confirmar zero warnings

- [ ] 13. Fix `src/lib/test-parser.ts` (1 warning — `no-explicit-any`)
  - [ ] 13.1 Linha 5: substituir `results: any[]` por `results: unknown[]` e adicionar type guard interno para acessar `result.name`, `result.status`, `result.duration`, `result.error`
  - [ ] 13.2 Executar `eslint src/lib/test-parser.ts` e confirmar zero warnings

- [ ] 14. Fix `src/security/DeepDependencyScanner.ts` (1 warning — `no-non-null-assertion`)
  - [ ] 14.1 Linha 220: substituir `queue.shift()!` por `const entry = queue.shift(); if (!entry) break;` e usar `entry` na desestruturação
  - [ ] 14.2 Executar `eslint src/security/DeepDependencyScanner.ts` e confirmar zero warnings

- [ ] 15. Fix `src/security/IssueGenerator.ts` (1 warning — `no-non-null-assertion`)
  - [ ] 15.1 Linha 82: substituir `patternsByType.get(pattern.type)!.push(pattern)` por `const list = patternsByType.get(pattern.type); if (list) list.push(pattern);`
  - [ ] 15.2 Executar `eslint src/security/IssueGenerator.ts` e confirmar zero warnings

- [ ] 16. Fix `src/security/LockFileParser.ts` (1 warning — `no-non-null-assertion`)
  - [ ] 16.1 Linha 296: substituir `const node = pathToNode.get(pkgPath)!` por `const node = pathToNode.get(pkgPath); if (!node) continue;`
  - [ ] 16.2 Executar `eslint src/security/LockFileParser.ts` e confirmar zero warnings

- [ ] 17. Fix `src/server.ts` (3 warnings — `no-explicit-any`)
  - [ ] 17.1 Linhas 64, 86, 118: definir `interface MCPParams { [key: string]: unknown }` e substituir `params: any` por `params: MCPParams` nos três `execute` handlers
  - [ ] 17.2 Usar `(params as MCPParams).code as string` etc. nos acessos a campos específicos
  - [ ] 17.3 Executar `eslint src/server.ts` e confirmar zero warnings

- [ ] 18. Fix `src/tools/validate.ts` (1 warning — `no-explicit-any`)
  - [ ] 18.1 Linha 67: inspecionar assinatura de `engine.canFix()` e substituir `issue.type as any` pelo tipo correto (provavelmente `as string` ou o union type de `IssueType`)
  - [ ] 18.2 Executar `eslint src/tools/validate.ts` e confirmar zero warnings

- [ ] 19. Fix `src/validate/environments/BrowserEnvironment.ts` (3 warnings — `no-explicit-any`)
  - [ ] 19.1 Linha 53: substituir `any` pelo tipo correto do Playwright (provavelmente `import('playwright').Browser` ou `unknown`)
  - [ ] 19.2 Linha 80: substituir `any` pelo tipo de página do Playwright (`import('playwright').Page`) ou `unknown`
  - [ ] 19.3 Linha 98: substituir `any` por `unknown` com type guard para acessar propriedades
  - [ ] 19.4 Executar `eslint src/validate/environments/BrowserEnvironment.ts` e confirmar zero warnings

- [ ] 20. Fix `src/validate/validators/BuildValidator.ts` (2 warnings — `no-explicit-any`)
  - [ ] 20.1 Linha 240: substituir `child: any` por `child: import('child_process').ChildProcess`
  - [ ] 20.2 Linha 293: substituir `Promise<Record<string, any> | null>` por `Promise<Record<string, unknown> | null>`
  - [ ] 20.3 Executar `eslint src/validate/validators/BuildValidator.ts` e confirmar zero warnings

- [ ] 21. Fix `src/validate/validators/DependencyValidator.ts` (4 warnings — `no-explicit-any`)
  - [ ] 21.1 Linha 77: substituir `packageJson?: Record<string, any>` por `packageJson?: Record<string, unknown>`
  - [ ] 21.2 Linha 128: definir `interface NpmAuditVulnerability { severity?: string; via?: Array<{ title?: string; url?: string } | string>; fixAvailable?: boolean }` e substituir `Record<string, any>` por `Record<string, NpmAuditVulnerability>`
  - [ ] 21.3 Linha 155: substituir `outdated as Record<string, any>` por `outdated as Record<string, { current?: string; wanted?: string; latest?: string }>`
  - [ ] 21.4 Linha 265: substituir `Promise<Record<string, any> | null>` por `Promise<Record<string, unknown> | null>`
  - [ ] 21.5 Executar `eslint src/validate/validators/DependencyValidator.ts` e confirmar zero warnings

- [ ] 22. Fix `src/validate/validators/WebGLValidator.ts` (8 warnings — `no-explicit-any`)
  - [ ] 22.1 Linha 29: substituir `chromium: any` por `chromium: typeof import('@playwright/test').chromium | undefined`
  - [ ] 22.2 Linha 57: substituir `any` pelo tipo de browser do Playwright ou `unknown`
  - [ ] 22.3 Linhas 84, 85, 92, 93, 99, 115: substituir `any` por `unknown` nos callbacks de `page.evaluate()` — Playwright aceita `unknown` nesses contextos
  - [ ] 22.4 Executar `eslint src/validate/validators/WebGLValidator.ts` e confirmar zero warnings

- [ ] 23. Fix `src/validators/E2EValidator.ts` (3 warnings — `no-explicit-any`)
  - [ ] 23.1 Linha 99 (×2): substituir `any` nos callbacks de `page.evaluate()` por `unknown`
  - [ ] 23.2 Linha 102: substituir `any` por `unknown` no tipo de retorno do evaluate
  - [ ] 23.3 Executar `eslint src/validators/E2EValidator.ts` e confirmar zero warnings

- [ ] 24. Fix `src/validators/RuntimeValidator.ts` (2 warnings — `no-non-null-assertion`)
  - [ ] 24.1 Linha 146: substituir `!` por optional chaining ou guard explícito
  - [ ] 24.2 Linha 180: substituir `!` por optional chaining com fallback `?? ''`
  - [ ] 24.3 Executar `eslint src/validators/RuntimeValidator.ts` e confirmar zero warnings

- [ ] 25. Verificação global e CI enforcement
  - [ ] 25.1 Executar `npm run lint 2>&1 | tee /tmp/lint-after.txt` e confirmar 0 warnings
  - [ ] 25.2 Executar `tsc --noEmit` e confirmar zero erros de compilação
  - [ ] 25.3 Executar `npm test -- --run` e confirmar todos os testes passando
  - [ ] 25.4 Atualizar `package.json`: mudar `"lint": "eslint src --ext .ts"` para `"lint": "eslint src --ext .ts --max-warnings 0"`
  - [ ] 25.5 Atualizar `.github/workflows/ci.yml`: mudar o step de lint para `run: npm run lint` (já usará `--max-warnings 0` via package.json)
