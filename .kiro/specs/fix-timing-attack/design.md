# Design Document — fix-timing-attack

## Technical Context

### Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type { a: string, b: string }
  OUTPUT: boolean

  // Qualquer comparação de secret/API key usando === é vulnerável
  RETURN X.a IS_SECRET_COMPARISON AND uses_native_equality(X)
END FUNCTION
```

### Fix Checking Property

```pascal
// Property: Fix Checking — safeCompare retorna resultado correto
FOR ALL X WHERE isBugCondition(X) DO
  result ← safeCompare(X.a, X.b)
  ASSERT result = (X.a === X.b)          // corretude funcional
  ASSERT constant_time(safeCompare)      // sem vazamento de tempo
END FOR
```

### Preservation Property

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT behavior_before_fix(X) = behavior_after_fix(X)
END FOR
```

---

## Architecture

### Novo arquivo: `backend/middleware/safeCompare.js`

Helper centralizado que encapsula `crypto.timingSafeEqual`:

```javascript
import { timingSafeEqual } from 'crypto';

/**
 * Compara duas strings em tempo constante para prevenir timing attacks.
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 * @returns {boolean}
 */
export function safeCompare(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
```

**Decisões de design:**
- Retorna `false` para qualquer valor falsy (null, undefined, '') sem lançar exceção
- Verifica comprimentos antes de chamar `timingSafeEqual` (requisito da API do Node.js)
- Usa `Buffer.from(string)` com encoding UTF-8 padrão, adequado para tokens ASCII/hex

---

## Affected Files

### `backend/routes/admin.js` — `requireAdmin`

Antes:
```javascript
if (!secret || token !== secret) {
```

Depois:
```javascript
import { safeCompare } from '../middleware/safeCompare.js';
// ...
if (!safeCompare(token, secret)) {
```

### `backend/server.js` — `requireAdminAuth`

Antes:
```javascript
if (!token || token !== process.env.ADMIN_SECRET) {
```

Depois:
```javascript
import { safeCompare } from './middleware/safeCompare.js';
// ...
if (!safeCompare(token, process.env.ADMIN_SECRET)) {
```

### `backend/routes/usage.js` — lookup de API key

O lookup `keys[apiKey]` usa a API key diretamente como chave de objeto, o que realiza comparação nativa. A correção itera sobre as entradas para usar `safeCompare`:

Antes:
```javascript
const client = keys[apiKey];
```

Depois:
```javascript
import { safeCompare } from '../middleware/safeCompare.js';
// ...
const entry = Object.entries(keys).find(([k]) => safeCompare(k, apiKey));
const client = entry?.[1];
```

---

## Performance Decision — O(n) vs O(1) no lookup de usage.js

A correção em `usage.js` substitui o lookup O(1) por objeto (`keys[apiKey]`) por uma iteração O(n) com `Object.entries(keys).find(...)`.

**Por que não usar índice SHA-256 para O(1)?**

Uma alternativa seria manter um `Map<sha256(key), clientData>` como índice secundário e comparar hashes com `timingSafeEqual`. Isso manteria O(1) e segurança de tempo constante.

**Decisão: manter O(n) para MVP**

- O arquivo `api-keys.json` terá no máximo ~200 entradas antes da migração para PostgreSQL (gatilho 4 do `METRICAS_INTERNAS.md`)
- Com 200 entradas, a iteração completa executa em < 1ms — imperceptível para o usuário
- O índice SHA-256 adiciona complexidade de manutenção (sincronização entre arquivo JSON e Map em memória)
- Quando o `apiKeyStore` migrar para PostgreSQL, o lookup voltará a ser O(1) via índice de banco de dados

**Gatilho para reavaliar:** se `totalClients >= 500` antes da migração para PostgreSQL, considerar o índice SHA-256 em memória.

---

## Correctness Properties (PBT)

### Propriedade 1 — Equivalência funcional

Para qualquer par de strings `(a, b)`, `safeCompare(a, b)` deve retornar o mesmo resultado que `a === b`.

```pascal
FOR ALL a: string, b: string DO
  ASSERT safeCompare(a, b) = (a === b)
END FOR
```

### Propriedade 2 — Segurança com valores falsy

`safeCompare(null, b)`, `safeCompare(a, null)`, `safeCompare('', b)` devem retornar `false` sem lançar exceção.

```pascal
FOR ALL b: string DO
  ASSERT safeCompare(null, b) = false AND no_exception
  ASSERT safeCompare(b, null) = false AND no_exception
  ASSERT safeCompare('', b) = false AND no_exception
END FOR
```

### Propriedade 3 — Strings de comprimentos diferentes

Para qualquer par `(a, b)` onde `a.length !== b.length`, `safeCompare` deve retornar `false` sem lançar exceção.

```pascal
FOR ALL a: string, b: string WHERE a.length ≠ b.length DO
  ASSERT safeCompare(a, b) = false AND no_exception
END FOR
```

---

## Test Strategy

- Testes unitários para `safeCompare` cobrindo: igualdade, diferença, falsy, comprimentos distintos
- Testes de integração para `requireAdmin` e `requireAdminAuth` verificando que 401 é retornado para tokens inválidos e acesso concedido para tokens válidos
- Testes de integração para `/v1/usage` verificando que API keys válidas/inválidas continuam funcionando corretamente
