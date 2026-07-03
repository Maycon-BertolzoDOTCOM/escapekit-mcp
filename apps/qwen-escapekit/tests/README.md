# Guia de Testes - qwen-escapekit

Este documento descreve a estrutura de testes unitários e de integração da CLI qwen-escapekit.

## 🧪 Visão Geral

Usamos **Vitest** como framework de testes, que oferece:
- Compatibilidade com APIs do Jest/Mocha
- Execução paralela de testes
- Coverage nativo com V8
- UI de testes opcional

## 📁 Estrutura de Arquivos de Teste

```
tests/
├── mocks.ts                          # Fixtures e mocks compartilhados
├── source-resolver.test.ts           # Testes de extração de metadados
├── contract-generator.test.ts        # Testes de geração de contratos
├── contract-validator.test.ts        # Testes de validação YAML
└── boilerplate-generator.test.ts     # Testes de geração de código
```

## 🚀 Comandos de Teste

### Executar todos os testes

```bash
npm test
```

### Executar com coverage

```bash
npm run test:coverage
```

Gera relatório em `coverage/`:
- `coverage/index.html` - Relatório HTML interativo
- `coverage/coverage-summary.json` - Resumo JSON

### Executar com UI

```bash
npm run test -- --ui
```

Abre interface web em `http://localhost:51204/__vitest__/`

### Executar testes específicos

```bash
# Por arquivo
npm test source-resolver

# Por padrão
npm test -- --grep "deve validar"

# Em modo watch (reexecuta ao salvar)
npm test -- --watch
```

## 📊 Cobertura de Testes

### source-resolver.test.ts

| Funcionalidade | Testes | Status |
|----------------|--------|--------|
| DOI válido | ✅ | Coberto |
| DOI inválido | ✅ | Coberto |
| arXiv ID | ✅ | Coberto |
| URL arXiv | ✅ | Coberto |
| URL genérica | ✅ | Coberto |
| PDF local | ✅ | Coberto |
| Detecção automática | ✅ | Coberto |
| Tratamento de erros | ✅ | Coberto |

### contract-generator.test.ts

| Funcionalidade | Testes | Status |
|----------------|--------|--------|
| Verificar Ollama | ✅ | Coberto |
| Gerar contrato | ✅ | Coberto |
| Extrair YAML | ✅ | Coberto |
| Formato inesperado | ✅ | Coberto |
| Build prompt | ✅ | Coberto |
| Configurações (modelo, temperatura) | ✅ | Coberto |

### contract-validator.test.ts

| Funcionalidade | Testes | Status |
|----------------|--------|--------|
| YAML válido | ✅ | Coberto |
| Campos faltando | ✅ | Coberto |
| YAML mal formatado | ✅ | Coberto |
| Validação de facts | ✅ | Coberto |
| Validação de patterns | ✅ | Coberto |
| Validação de rules | ✅ | Coberto |
| Validação de cases | ✅ | Coberto |
| Referências cruzadas | ✅ | Coberto |
| Cenários reais | ✅ | Coberto |

### boilerplate-generator.test.ts

| Funcionalidade | Testes | Status |
|----------------|--------|--------|
| Gerar código | ✅ | Coberto |
| Gerar testes | ✅ | Coberto |
| Extrair nome detector | ✅ | Coberto |
| Nome padrão | ✅ | Coberto |
| Extrair código | ✅ | Coberto |
| Chamada Ollama | ✅ | Coberto |

## 🔧 Mocks

### APIs Externas

Mockamos todas as APIs externas para testes unitários:

- **Crossref API**: Mockada com `mockCrossrefResponse`
- **arXiv API**: Mockada com `mockArxivResponse`
- **Ollama API**: Mockada com `mockOllamaResponse`

### Como Mockar

```typescript
import { vi } from 'vitest';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Nos testes
mockedAxios.get.mockResolvedValueOnce({ data: mockData });
mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));
```

## 📝 Escrevendo Novos Testes

### Estrutura Padrão

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MyEngine } from '../src/engines/my-engine.js';

describe('MyEngine', () => {
  let engine: MyEngine;

  beforeEach(() => {
    engine = new MyEngine();
    vi.clearAllMocks();
  });

  describe('methodName', () => {
    it('deve fazer algo esperado', async () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = await engine.methodName(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Melhores Práticas

1. **Nomes descritivos**: `deve retornar metadados corretos para DOI válido`
2. **Um teste por comportamento**: Não teste múltiplas coisas em um único `it`
3. **Mocks isolados**: Use `beforeEach` para resetar mocks
4. **Teste erros**: Sempre teste cenários de falha
5. **Use fixtures**: Centralize dados de teste em `mocks.ts`

## 🐛 Debugging de Testes

### Verbose mode

```bash
npm test -- --reporter=verbose
```

### Teste específico

```bash
npm test -- --reporter=verbose -t "deve validar contrato"
```

### Inspecionar mocks

```typescript
// Verificar se mock foi chamado
expect(mockedAxios.get).toHaveBeenCalled();

// Verificar argumentos
expect(mockedAxios.get).toHaveBeenCalledWith('https://api.crossref.org/...');

// Verificar número de chamadas
expect(mockedAxios.get).toHaveBeenCalledTimes(2);
```

## 📈 Coverage Goals

Meta mínima de cobertura:

| Tipo | Meta | Atual |
|------|------|-------|
| Lines | 80% | TBD |
| Functions | 85% | TBD |
| Branches | 75% | TBD |

Para verificar:

```bash
npm run test:coverage
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
```

## 🔄 Integração Contínua

Os testes são executados automaticamente no GitHub Actions em:
- Cada push para `main`
- Cada pull request
- Antes de publicação no npm

## 🚨 Problemas Comuns

### "Cannot find module"

Verifique se o import está correto:
```typescript
// ✅ Correto (com .js)
import { MyEngine } from '../src/engines/my-engine.js';

// ❌ Errado
import { MyEngine } from '../src/engines/my-engine';
```

### "vi is not defined"

Adicione no topo do arquivo:
```typescript
import { vi } from 'vitest';
```

### Mock não funciona

Certifique-se de mockar antes do import:
```typescript
// ✅ Correto
vi.mock('axios');
import axios from 'axios';

// ❌ Errado
import axios from 'axios';
vi.mock('axios');
```

## 📚 Referências

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://github.com/vitest-dev/vitest/blob/main/examples/basic/test/suite.test.ts)
- [Mocking Guide](https://vitest.dev/guide/mocking.html)

---

**Status dos Testes**: ✅ Todos os testes implementados e passando

**Próximo Passo**: Executar `npm run test:coverage` para verificar cobertura real
