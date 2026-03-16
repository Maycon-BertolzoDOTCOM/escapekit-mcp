# testintel - Geração Automática de Testes

## Visão Geral

**testintel** é um framework de geração automática de testes que combina:
- **qwen-escapekit**: Geração de testes via IA usando contratos factuais
- **Contratos Fatoriais (YAML)**: Especificações de comportamento esperado
- **AST Analysis**: Entendimento da estrutura dos detectores
- **Property-Based Testing (fast-check)**: Testes baseados em propriedades
- **Templates Vitest**: Esqueletos padronizados

### Objetivos do Sprint 2

- Criar infraestrutura híbrida de geração de testes
- Gerar 400+ testes para detectores existentes
- Reduzir em 30% o tempo de escrita de testes
- Alcançar taxa de sucesso >=90% dos testes gerados

---

## Arquitetura Híbrida

### Componentes

```
scripts/
  generate-tests.ts              # Script principal de geração
  ast-analyzer.ts              # Análise de AST TypeScript
  contract-loader.ts           # Carregamento de contratos YAML
  prompt-builder.ts            # Construtor de prompts para IA
  test-validator.ts            # Validação de testes gerados

templates/
  base.test.ts.hbs            # Template base Vitest
  detector.test.ts.hbs         # Template específico detectores

prompts/
  test-generation.yaml          # Prompt padrão para geração
  refinement.yaml              # Prompt para refinamento
```

### Fluxo de Geração

```
1. Análise do Detector (ast-analyzer.ts)
   ↓
2. Carregamento de Contrato (contract-loader.ts)
   ↓
3. Construção de Prompt (prompt-builder.ts)
   ↓
4. Geração via qwen-escapekit
   ↓
5. Aplicação de Template
   ↓
6. Validação com Vitest
   ↓
7. Refinamento (se necessário)
```

---

## Tecnologias Escolhidas

### Core (já no projeto)
- **qwen-escapekit**: CLI de IA para geração de testes
- **Vitest**: Framework de testes (já integrado)
- **TypeScript 5.3+**: Linguagem do projeto
- **ts-morph**: Parser AST TypeScript

### Novas dependências
- **handlebars**: Sistema de templates
- **fast-check**: Property-based testing
- **yaml**: Carregamento de contratos factuais
- **commander**: CLI interface

---

## Implementação Detalhada

### Tarefa 2.1: Criar infraestrutura para geração de testes (2 dias)

**Arquivos**:
- `scripts/generate-tests.ts` - Script principal CLI
- `scripts/ast-analyzer.ts` - Análise de AST TypeScript
- `scripts/contract-loader.ts` - Carregamento de contratos YAML
- `scripts/prompt-builder.ts` - Construtor de prompts para IA
- `scripts/test-validator.ts` - Validação de testes gerados

### Tarefa 2.2: Gerar testes para GhostImportDetector (2 dias)

**Detector Alvo**: `src/detectors/GhostImportDetector.ts`

**Passos**:
1. Analisar detector usando AST analyzer
2. Carregar contrato factual (se existir)
3. Construir prompt estruturado
4. Executar qwen-escapekit com prompt
5. Validar testes gerados com Vitest

**Cenários de Teste**:
- Código com import de pacote existente
- Código com import de pacote inexistente
- Múltiplos imports (mistos)
- Imports dinâmicos
- Scoped packages
- Arquivo vazio ou sem imports
- Erro de rede na API do npm

### Tarefa 2.3: Adicionar property-based testing (2 dias)

**Instalação**: `npm install -D fast-check @types/fast-check`

**Exemplo de Property-Based Test**:
```typescript
import { test } from 'vitest';
import { fc } from 'fast-check';
import { GhostImportDetector } from '../src/detectors/GhostImportDetector';

describe('GhostImportDetector - Property-Based Tests', () => {
  test('should handle all valid import formats', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9@/._-]+$/),
        async (packageName) => {
          const detector = new GhostImportDetector();
          const result = await detector.detect(`import ${packageName} from 'pkg'`);
          expect(result).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Tarefa 2.4: Escalar para outros detectores (2 dias)

**Detectores Alvo**:
1. MockApiDetector
2. ImportReplacer
3. UnicodeAnalyzer
4. SandboxDetector
5. SlopsquatDetector

**Estratégia**:
- Aplicar script de geração para cada detector
- Adaptar prompts conforme necessário
- Validação iterativa
- Meta: 400+ novos testes

### Tarefa 2.5: Medir redução de tempo (1 dia)

**Metodologia**:
1. Selecionar amostra de 10 testes gerados
2. Estimar tempo de escrita manual (horas)
3. Medir tempo de geração automática (minutos)
4. Calcular redução percentual

**Fórmula**: `Redução % = (Tempo Manual - Tempo Automático) / Tempo Manual * 100`

**Meta**: Redução >= 30%

### Tarefa 2.6: Otimizar prompts e templates (2 dias)

**Métricas**:
- Taxa de sucesso (% testes passando)
- Cobertura de código
- Qualidade de assertions
- Legibilidade do código gerado

**Ajustes**:
- Adicionar mais exemplos no prompt
- Refinar templates de projeto
- Melhorar prompts de refinamento

### Tarefa 2.7: Documentar workflow (2 dias)

**Documentos**:
- `docs/test-generation.md` - Guia completo
- `CONTRIBUTING.md` - Seção de contribuição
- Examples em `examples/test-generation/`

**Conteúdo**:
- Instalação e configuração
- Uso do script de geração
- Adaptação de prompts
- Validação e refinamento
- Troubleshooting

---

## Impacto Esperado

### Métricas de Sucesso

| Métrica | Meta | Status |
|---------|------|--------|
| Novos testes gerados | 400+ | ⏳ |
| Taxa de sucesso | >=90% | ⏳ |
| Redução de tempo | >=30% | ⏳ |
| Cobertura de código | +15% | ⏳ |

---

## Arquivos a Serem Criados/Modificados

**Created**:
- `scripts/generate-tests.ts`
- `scripts/ast-analyzer.ts`
- `scripts/contract-loader.ts`
- `scripts/prompt-builder.ts`
- `scripts/test-validator.ts`
- `docs/test-generation.md`

**Modified**:
- `package.json` (adicionar scripts e dependências)
- `CONTRIBUTING.md` (adicionar seção)
