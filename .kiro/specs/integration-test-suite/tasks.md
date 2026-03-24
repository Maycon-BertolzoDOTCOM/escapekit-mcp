# Implementation Plan

## Tasks

- [ ] 1. Criar fixture `ghost-import-project`
  - Criar `tests/fixtures/ghost-import-project/package.json` com `lodash` e `axios` em `dependencies`, sem `fake-api` nem `mock-fetch`
  - Criar `tests/fixtures/ghost-import-project/src/index.ts` com `import { foo } from 'fake-api'` e `import { bar } from 'mock-fetch'` — ambos correspondem aos padrões `fake-` e `mock-` do `DependencyValidator`
  - Verificar que o `DependencyValidator.checkGhostPackages()` detecta os imports ao processar o arquivo `src/index.ts`
  - Arquivos: `tests/fixtures/ghost-import-project/package.json`, `tests/fixtures/ghost-import-project/src/index.ts`

- [ ] 2. Criar fixture `webgl-project`
  - Criar `tests/fixtures/webgl-project/package.json` com `three: "^0.160.0"` em `dependencies`
  - Criar `tests/fixtures/webgl-project/src/main.ts` com código Three.js básico (`Scene`, `PerspectiveCamera`, `WebGLRenderer`)
  - Garantir que o diretório `src/utils/` NÃO existe no fixture (o `FallbackGenerator` precisa criá-lo)
  - Verificar que o `FallbackGenerator.detectWebGLLibrary()` retorna `'three'` ao ler o `package.json`
  - Arquivos: `tests/fixtures/webgl-project/package.json`, `tests/fixtures/webgl-project/src/main.ts`

- [ ] 3. Criar fixture `vulnerable-project`
  - Criar `tests/fixtures/vulnerable-project/package.json` com `event-stream: "3.3.4"` e `lodash` em `dependencies`
  - Criar `tests/fixtures/vulnerable-project/src/index.ts` com `import eventStream from 'event-stream'`
  - Arquivos: `tests/fixtures/vulnerable-project/package.json`, `tests/fixtures/vulnerable-project/src/index.ts`

- [ ] 4. Criar fixture `clean-project`
  - Criar `tests/fixtures/clean-project/package.json` com `lodash` e `axios` em `dependencies`
  - Criar `tests/fixtures/clean-project/src/index.ts` com imports apenas de `lodash` e `axios` — sem ghost patterns, sem pacotes vulneráveis
  - Verificar que nenhum import no arquivo corresponde aos padrões `fake-`, `mock-`, `sandbox-`, `claude-`, `replit-`
  - Arquivos: `tests/fixtures/clean-project/package.json`, `tests/fixtures/clean-project/src/index.ts`

- [ ] 5. Criar arquivo de testes de integração — estrutura e helpers
  - Criar `tests/integration/ValidationEngine.integration.test.ts`
  - Adicionar imports: `ValidationEngine`, `FallbackGenerator`, `join`, `cp`, `rm`, `access`, `tmpdir`, `randomUUID`
  - Implementar helper `copyFixture(fixtureName: string): Promise<string>` que copia o fixture para `tmpdir()/<uuid>` e retorna o caminho
  - Declarar `const engine = new ValidationEngine()` no escopo do módulo
  - Declarar `const FIXTURES_DIR = join(import.meta.dirname, '../fixtures')`
  - Arquivo: `tests/integration/ValidationEngine.integration.test.ts`

- [ ] 6. Implementar teste de detecção de ghost imports
  - No arquivo de testes de integração, adicionar `describe('ghost import detection')`
  - Implementar teste: `validate(ghostImportFixturePath, { level: 'basic' })` → `remainingIssues` contém `Issue` com `type: 'GHOST_IMPORT'`
  - Verificar que `result.canDeploy === false`
  - Verificar que o `Issue` com `type: 'GHOST_IMPORT'` tem `severity: 'error'`
  - Usar o fixture original (sem cópia para tmpdir) — sem auto-fix, sem modificação
  - Arquivo: `tests/integration/ValidationEngine.integration.test.ts`

- [ ] 7. Implementar teste de detecção de vulnerabilidade de segurança
  - Adicionar `describe('security detection')`
  - Implementar teste: `validate(vulnerableFixturePath, { level: 'basic' })` → condição OR: `checks.security?.passed === false` OU `remainingIssues` com `Issue` de `type: 'SECURITY_VULNERABILITY'`
  - Verificar que `result.canDeploy === false` quando a condição OR for satisfeita via `checks.security.passed === false`
  - Usar condição OR para compatibilidade com estado atual e futuro da spec `connect-security-validator`
  - Arquivo: `tests/integration/ValidationEngine.integration.test.ts`

- [ ] 8. Implementar teste de projeto limpo
  - Adicionar `describe('clean project')`
  - Implementar teste: `validate(cleanFixturePath, { level: 'basic' })` → `canDeploy === true`
  - Verificar que `remainingIssues` não contém nenhum `Issue` com `severity: 'error'`
  - Arquivo: `tests/integration/ValidationEngine.integration.test.ts`

- [ ] 9. Implementar teste de auto-fix de ghost imports
  - Adicionar `describe('auto-fix ghost imports')`
  - Declarar `let tmpPath: string` no escopo do describe
  - No `afterEach`, remover `tmpPath` com `rm(tmpPath, { recursive: true, force: true })`
  - Implementar teste: copiar `ghost-import-project` para tmpdir via `copyFixture`, chamar `validate(tmpPath, { level: 'basic', autoFix: true })`
  - Verificar que `result.fixesApplied.length > 0`
  - Verificar que `result.fixesApplied` contém ao menos um `Fix` com `issueType: 'GHOST_IMPORT'` e `applied: true`
  - Arquivo: `tests/integration/ValidationEngine.integration.test.ts`

- [ ] 10. Implementar teste de geração de fallback WebGL
  - Adicionar `describe('WebGL fallback generation')`
  - Declarar `let tmpPath: string` no escopo do describe
  - No `afterEach`, remover `tmpPath` com `rm(tmpPath, { recursive: true, force: true })`
  - Implementar teste: copiar `webgl-project` para tmpdir via `copyFixture`
  - Instanciar `FallbackGenerator` diretamente e chamar `generator.fix(tmpPath, { type: 'WEBGL_UNSUPPORTED', severity: 'error', message: 'WebGL not supported' })`
  - Verificar que `fix.applied === true`
  - Verificar que o arquivo `src/utils/webgl-fallback.ts` existe no tmpdir via `access()`
  - Verificar que o conteúdo do arquivo contém `checkWebGLSupport`
  - Arquivo: `tests/integration/ValidationEngine.integration.test.ts`

- [ ] 11. Verificar diagnósticos e corrigir erros de tipo
  - Executar `getDiagnostics` em `tests/integration/ValidationEngine.integration.test.ts`
  - Verificar que `import.meta.dirname` está disponível (requer `"moduleResolution": "bundler"` ou `"node16"` no tsconfig)
  - Se `import.meta.dirname` não estiver disponível, substituir por `new URL('.', import.meta.url).pathname`
  - Verificar que todos os imports de `src/validate/` usam extensão `.js` (ESM)
  - Corrigir quaisquer erros de tipo TypeScript introduzidos
  - Executar `getDiagnostics` nos arquivos de fixture para garantir que são TypeScript válido
