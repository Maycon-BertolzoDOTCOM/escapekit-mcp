# Design Document

## Overview

Criação de uma suíte de testes de integração end-to-end para o `ValidationEngine`. A abordagem é minimalista: quatro projetos fixture com problemas controlados em `tests/fixtures/`, um arquivo de testes de integração em `tests/integration/ValidationEngine.integration.test.ts` que chama `ValidationEngine.validate()` diretamente com os fixtures reais, e uso de `tmpdir()` para isolar modificações de auto-fix. Nenhum componente de produção é alterado — apenas novos arquivos de teste e fixture são criados.

A chave do design é usar `level: 'basic'` em todos os testes para evitar que o `LocalEnvironment` seja instanciado (ele só é ativado em `standard` e `thorough`), garantindo que os testes sejam rápidos e não dependam de servidores externos.

---

## Architecture

### Arquivos criados

```
tests/
├── fixtures/
│   ├── ghost-import-project/
│   │   ├── package.json          ← deps reais + src com ghost imports
│   │   └── src/index.ts          ← import { foo } from 'fake-api'
│   ├── webgl-project/
│   │   ├── package.json          ← three em dependencies
│   │   └── src/main.ts           ← código Three.js básico
│   ├── vulnerable-project/
│   │   ├── package.json          ← event-stream em dependencies
│   │   └── src/index.ts          ← import 'event-stream'
│   └── clean-project/
│       ├── package.json          ← lodash, axios
│       └── src/index.ts          ← código limpo
└── integration/
    └── ValidationEngine.integration.test.ts
```

### Fluxo dos testes de integração

```
ValidationEngine.integration.test.ts
  │
  ├─ describe('ghost import detection')
  │     └─ validate(ghostImportFixture, { level: 'basic' })
  │           → remainingIssues contém GHOST_IMPORT
  │           → canDeploy === false
  │
  ├─ describe('security detection')
  │     └─ validate(vulnerableFixture, { level: 'basic' })
  │           → checks.security.passed === false OU issue SECURITY_VULNERABILITY
  │           → canDeploy === false
  │
  ├─ describe('clean project')
  │     └─ validate(cleanFixture, { level: 'basic' })
  │           → canDeploy === true
  │           → sem issues severity: 'error'
  │
  ├─ describe('auto-fix ghost imports')
  │     └─ copiar ghostImportFixture → tmpdir
  │        validate(tmpdir, { level: 'basic', autoFix: true })
  │           → fixesApplied.length > 0
  │           → Fix com issueType: 'GHOST_IMPORT', applied: true
  │
  └─ describe('auto-fix WebGL fallback')
        └─ copiar webglFixture → tmpdir
           validate(tmpdir, { level: 'basic', autoFix: true })
              → arquivo src/utils/webgl-fallback.ts criado
              → Fix com issueType: 'WEBGL_UNSUPPORTED', applied: true
```

---

## Detailed Design

### 1. Fixture: `ghost-import-project`

O `DependencyValidator` detecta ghost imports via padrões regex: `fake-`, `mock-`, `sandbox-`, `claude-`, `replit-`. O fixture usa `fake-api` e `mock-fetch` para garantir detecção determinística.

**`tests/fixtures/ghost-import-project/package.json`**
```json
{
  "name": "ghost-import-project",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "lodash": "^4.17.21",
    "axios": "^1.6.0"
  }
}
```

**`tests/fixtures/ghost-import-project/src/index.ts`**
```typescript
import { foo } from 'fake-api';
import { bar } from 'mock-fetch';
import _ from 'lodash';

export function main() {
  return _.identity({ foo, bar });
}
```

O `package.json` não lista `fake-api` nem `mock-fetch` em `dependencies` — mas isso não é o que o `DependencyValidator` verifica. O validador detecta ghost imports pelos padrões de nome, não pela ausência no `package.json`. Portanto, o fixture precisa apenas ter os imports no código-fonte.

### 2. Fixture: `webgl-project`

O `FallbackGenerator` detecta a biblioteca WebGL via `package.json` (campo `three` em `dependencies`) e gera o fallback em `src/utils/webgl-fallback.ts`. O fixture não deve ter esse arquivo para que o auto-fix possa criá-lo.

**`tests/fixtures/webgl-project/package.json`**
```json
{
  "name": "webgl-project",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "three": "^0.160.0"
  }
}
```

**`tests/fixtures/webgl-project/src/main.ts`**
```typescript
import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

export { scene, camera, renderer };
```

**Nota sobre detecção de WEBGL_UNSUPPORTED**: O `ValidationEngine` atual não detecta automaticamente `WEBGL_UNSUPPORTED` via `DependencyValidator` — esse issue é gerado pelo `WebGLValidator` (conectado via spec `connect-webgl-validator`). Para o teste de auto-fix funcionar, o teste deve injetar manualmente o issue `WEBGL_UNSUPPORTED` ou chamar o `FallbackGenerator` diretamente. O design do teste de integração para WebGL testa o `FallbackGenerator` diretamente, não via `ValidationEngine.validate()`, para evitar dependência de specs ainda não implementadas.

### 3. Fixture: `vulnerable-project`

O `SecurityValidator` (quando conectado via spec `connect-security-validator`) detecta `event-stream` como pacote vulnerável. O fixture usa `event-stream` em `dependencies`.

**`tests/fixtures/vulnerable-project/package.json`**
```json
{
  "name": "vulnerable-project",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "event-stream": "3.3.4",
    "lodash": "^4.17.21"
  }
}
```

**`tests/fixtures/vulnerable-project/src/index.ts`**
```typescript
import eventStream from 'event-stream';
import _ from 'lodash';

export function createStream() {
  return eventStream.pipeline(
    eventStream.through((data: unknown) => data)
  );
}
```

### 4. Fixture: `clean-project`

Projeto sem ghost imports, sem pacotes vulneráveis conhecidos e sem dependências WebGL.

**`tests/fixtures/clean-project/package.json`**
```json
{
  "name": "clean-project",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "lodash": "^4.17.21",
    "axios": "^1.6.0"
  }
}
```

**`tests/fixtures/clean-project/src/index.ts`**
```typescript
import _ from 'lodash';
import axios from 'axios';

export async function fetchData(url: string) {
  const response = await axios.get(url);
  return _.pick(response.data, ['id', 'name']);
}
```

### 5. Arquivo de testes de integração

**Estrutura do arquivo `tests/integration/ValidationEngine.integration.test.ts`**:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'path';
import { cp, rm, access } from 'fs/promises';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { ValidationEngine } from '../../src/validate/ValidationEngine.js';
import { FallbackGenerator } from '../../src/validate/auto-fix/FallbackGenerator.js';

const FIXTURES_DIR = join(import.meta.dirname, '../fixtures');
const engine = new ValidationEngine();

// Helper: copia fixture para tmpdir e retorna o caminho
async function copyFixture(fixtureName: string): Promise<string> {
  const src = join(FIXTURES_DIR, fixtureName);
  const dest = join(tmpdir(), `escapekit-test-${randomUUID()}`);
  await cp(src, dest, { recursive: true });
  return dest;
}
```

**Testes por cenário**:

1. **Ghost import detection** — chama `validate()` com `level: 'basic'` no fixture original (sem auto-fix, sem modificação):
   ```typescript
   const result = await engine.validate(ghostImportFixture, { level: 'basic' });
   expect(result.remainingIssues.some(i => i.type === 'GHOST_IMPORT')).toBe(true);
   expect(result.canDeploy).toBe(false);
   ```

2. **Security detection** — chama `validate()` com `level: 'basic'` no fixture vulnerável. Como o `SecurityValidator` pode ou não estar conectado dependendo do estado da implementação, o teste verifica a condição OR:
   ```typescript
   const result = await engine.validate(vulnerableFixture, { level: 'basic' });
   const hasSecurityIssue =
     result.checks.security?.passed === false ||
     result.remainingIssues.some(i => i.type === 'SECURITY_VULNERABILITY');
   expect(hasSecurityIssue).toBe(true);
   ```

3. **Clean project** — chama `validate()` com `level: 'basic'` no fixture limpo:
   ```typescript
   const result = await engine.validate(cleanFixture, { level: 'basic' });
   expect(result.canDeploy).toBe(true);
   ```

4. **Auto-fix ghost imports** — copia fixture para tmpdir, aplica auto-fix:
   ```typescript
   const tmpPath = await copyFixture('ghost-import-project');
   const result = await engine.validate(tmpPath, { level: 'basic', autoFix: true });
   expect(result.fixesApplied.length).toBeGreaterThan(0);
   expect(result.fixesApplied.some(f => f.issueType === 'GHOST_IMPORT' && f.applied)).toBe(true);
   ```

5. **WebGL fallback generation** — testa o `FallbackGenerator` diretamente com uma cópia do fixture:
   ```typescript
   const tmpPath = await copyFixture('webgl-project');
   const generator = new FallbackGenerator();
   const fix = await generator.fix(tmpPath, { type: 'WEBGL_UNSUPPORTED', severity: 'error', message: 'WebGL not supported' });
   expect(fix.applied).toBe(true);
   const fallbackPath = join(tmpPath, 'src', 'utils', 'webgl-fallback.ts');
   await expect(access(fallbackPath)).resolves.not.toThrow();
   ```

---

## Data Models

Nenhum modelo novo é necessário. Os tipos existentes são suficientes:

| Tipo | Origem | Uso nos testes |
|---|---|---|
| `ValidationResult` | `src/validate/types.ts` | Resultado verificado em cada teste |
| `Issue` | `src/validate/types.ts` | Verificação de `type`, `severity` em `remainingIssues` |
| `Fix` | `src/validate/types.ts` | Verificação de `issueType`, `applied` em `fixesApplied` |
| `ValidationOptions` | `src/validate/types.ts` | Passado para `validate()` com `level: 'basic'` |

---

## Correctness Properties

### P1 — Ghost import → GHOST_IMPORT em remainingIssues

Para qualquer projeto com ao menos um import de pacote com prefixo `fake-`, `mock-`, `sandbox-`, `claude-` ou `replit-`, `validate(project, { level: 'basic' }).remainingIssues` DEVE conter ao menos um `Issue` com `type: 'GHOST_IMPORT'`.

Formalmente: `∃ import ∈ sourceFiles: ghostPattern.test(import) → ∃ issue ∈ result.remainingIssues: issue.type === 'GHOST_IMPORT'`

Mecanismo: `DependencyValidator.checkGhostPackages()` itera sobre os arquivos fonte, extrai imports e verifica contra `defaultGhostPatterns`. O `ValidationEngine` converte cada `GhostPackage` em um `Issue` com `type: 'GHOST_IMPORT'`.

### P2 — event-stream em dependencies → falha de segurança

Para qualquer projeto com `event-stream` em `dependencies`, `validate(project, { level: 'basic' })` DEVE retornar `checks.security.passed === false` OU `remainingIssues` com ao menos um `Issue` com `type: 'SECURITY_VULNERABILITY'`.

Formalmente: `'event-stream' ∈ pkg.dependencies → result.checks.security?.passed === false ∨ ∃ issue: issue.type === 'SECURITY_VULNERABILITY'`

Mecanismo: Depende do estado de implementação do `SecurityValidator`. A condição OR garante que o teste seja válido tanto antes quanto depois da spec `connect-security-validator` ser implementada.

### P3 — Projeto limpo → canDeploy === true

Para qualquer projeto sem ghost imports e sem pacotes vulneráveis conhecidos, `validate(project, { level: 'basic' }).canDeploy` DEVE ser `true`.

Formalmente: `ghostPackages = [] ∧ knownVulnerablePackages ∩ dependencies = ∅ → result.canDeploy === true`

Mecanismo: `canDeploy = issues.filter(i => i.severity === 'error').length === 0`. Sem ghost imports e sem vulnerabilidades críticas, nenhum issue de `severity: 'error'` é gerado.

### P4 — Ghost import + autoFix → fixesApplied.length > 0

Para qualquer projeto com ao menos um ghost import, `validate(project, { level: 'basic', autoFix: true }).fixesApplied.length` DEVE ser maior que zero.

Formalmente: `∃ ghost ∈ ghostPackages → result.fixesApplied.length > 0`

Mecanismo: O `AutoFixEngine` roteia issues `GHOST_IMPORT` para o `MockReplacer`. O `MockReplacer` tenta substituir o ghost import via tabela hardcoded ou cadeia de resolução dinâmica. Mesmo que a substituição falhe (`applied: false`), o `Fix` é adicionado a `fixesApplied`. Para garantir `applied: true`, o fixture usa `fake-api` que está na tabela hardcoded do `MockReplacer`.

---

## Error Handling

| Cenário | Comportamento esperado |
|---|---|
| Fixture não encontrado | Teste falha com erro de I/O claro antes de chamar `validate()` |
| `validate()` lança exceção | Teste falha com a exceção propagada — indica bug no `ValidationEngine` |
| Auto-fix não aplica nenhuma correção | `fixesApplied` pode conter `Fix` com `applied: false` — teste verifica `applied: true` especificamente |
| `tmpdir()` sem espaço | Erro de I/O propagado — indica problema de ambiente, não de código |
| Arquivo `webgl-fallback.ts` já existe no tmpdir | `FallbackGenerator` sobrescreve o arquivo — comportamento esperado |

---

## Implementation Notes

- O `ValidationEngine` usa `level: 'basic'` nos testes para evitar a execução do `LocalEnvironment` (ativado apenas em `standard` e `thorough`). Isso garante que os testes não dependam de servidores externos.
- O teste de WebGL testa o `FallbackGenerator` diretamente (não via `ValidationEngine.validate()`) porque o `ValidationEngine` atual não gera `WEBGL_UNSUPPORTED` automaticamente — esse issue é gerado pelo `WebGLValidator` que ainda não está conectado ao engine.
- O teste de segurança usa condição OR (`checks.security?.passed === false || issue SECURITY_VULNERABILITY`) para ser válido tanto antes quanto depois da spec `connect-security-validator` ser implementada.
- Os fixtures não precisam de `node_modules` — o `DependencyValidator` lê apenas o `package.json` e os arquivos fonte para detecção de ghost imports. O `npm audit` pode falhar silenciosamente sem `node_modules`, o que é aceitável.
- O helper `copyFixture` usa `randomUUID()` para garantir que múltiplos testes paralelos não colidam no mesmo diretório temporário.
- O `afterEach` remove o diretório temporário com `rm(tmpPath, { recursive: true, force: true })` para não acumular arquivos.

### Estrutura de arquivos

| Arquivo | Status | Descrição |
|---|---|---|
| `tests/fixtures/ghost-import-project/package.json` | Novo | Fixture com deps reais |
| `tests/fixtures/ghost-import-project/src/index.ts` | Novo | Imports de ghost packages |
| `tests/fixtures/webgl-project/package.json` | Novo | Fixture com `three` |
| `tests/fixtures/webgl-project/src/main.ts` | Novo | Código Three.js básico |
| `tests/fixtures/vulnerable-project/package.json` | Novo | Fixture com `event-stream` |
| `tests/fixtures/vulnerable-project/src/index.ts` | Novo | Import de `event-stream` |
| `tests/fixtures/clean-project/package.json` | Novo | Fixture sem problemas |
| `tests/fixtures/clean-project/src/index.ts` | Novo | Código limpo |
| `tests/integration/ValidationEngine.integration.test.ts` | Novo | Testes de integração |
| `src/validate/ValidationEngine.ts` | Sem alteração | Componente testado |
| `src/validate/auto-fix/FallbackGenerator.ts` | Sem alteração | Testado diretamente |
