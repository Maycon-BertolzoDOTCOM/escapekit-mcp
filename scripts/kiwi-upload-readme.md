# Kiwi TCMS Upload Script

Script para upload de resultados de testes para o Kiwi TCMS via XML-RPC.

## Uso

```bash
npx tsx scripts/kiwi-upload-rest.ts --file <arquivo> [opções]
```

### Exemplo Completo

```bash
export KIWI_URL=https://kiwi.example.com
export KIWI_USERNAME=admin
export KIWI_PASSWORD=senha123
export KIWI_TEST_PLAN_ID=1
export KIWI_DEFAULT_CATEGORY_ID=1

npx tsx scripts/kiwi-upload-rest.ts \
  --file vitest-results.json \
  --auto-create-cases \
  --verbose
```

## Variáveis de Ambiente

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `KIWI_URL` | ✅ | URL do servidor Kiwi TCMS |
| `KIWI_USERNAME` | ✅ | Nome de usuário |
| `KIWI_PASSWORD` | ✅ | Senha do usuário |
| `KIWI_TEST_PLAN_ID` | ✅ | ID do plano de testes |
| `KIWI_PRODUCT_NAME` | ❌ | Nome do produto (padrão: EscapeKit) |
| `KIWI_DEFAULT_CATEGORY_ID` | ❌ | ID da categoria padrão para novos casos |

## Flags de Comando

| Flag | Descrição |
|------|-----------|
| `--file <arquivo>` | Arquivo de resultados de testes (obrigatório) |
| `--auto-create-cases` | Criar casos de teste automaticamente se não existirem |
| `--verbose` | Modo verboso - mostra logs detalhados |
| `--product-id <id>` | ID do produto ( альтернатива ao nome) |
| `--product-name <nome>` | Nome do produto |
| `--test-plan-id <id>` | ID do plano de testes |
| `--framework <vitest\|mocha\|custom>` | Framework dos testes |
| `--dry-run` | Simular upload sem enviar para o Kiwi TCMS |

## Formatos de Arquivo Suportados

### Vitest

O script detecta automaticamente arquivos de resultado do Vitest:
- `vitest-results.json`
- Padrão: `numTotalTestSuites`, `numPassedTestSuites`, etc.

### Mocha

O script detecta automaticamente arquivos de resultado do Mocha:
- Padrão: `stats`, `failures`, `passes`

### Custom

Para formatos personalizados, use `--framework custom` e forneça um arquivo JSON com formato:

```json
[
  {
    "testCase": "nome-do-teste",
    "outcome": "passed|failed|skipped",
    "error": "mensagem de erro (opcional)"
  }
]
```

## Configuração

### Via Arquivo JSON

Crie um arquivo `config/kiwi-tcms.json`:

```json
{
  "baseUrl": "${KIWI_URL}",
  "username": "${KIWI_USERNAME}",
  "password": "${KIWI_PASSWORD}",
  "defaultProduct": "EscapeKit",
  "defaultPlanId": 1,
  "testRunTemplate": "AutoTest-{DATE}",
  "timeout": 5000,
  "retries": 3,
  "defaultCategoryId": 1
}
```

As variáveis de ambiente podem ser interpoladas usando `${NOME_DA_VARIAVEL}`.

## Modo Dry-Run

Para testar sem enviar resultados reais:

```bash
npx tsx scripts/kiwi-upload-rest.ts \
  --file vitest-results.json \
  --dry-run
```

Isso irá:
- Carregar e analisar o arquivo de resultados
- Listar todos os casos de teste encontrados
- Mostrar estatísticas
- Simular a criação de casos (se `--auto-create-cases` estiver ativo)
- ** NÃO** enviar resultados para o Kiwi TCMS

## Códigos de Saída

- `0` - Upload concluído com sucesso
- `1` - Erro durante o upload

## Integração com GitHub Actions

Exemplo de workflow `.github/workflows/kiwi-upload.yml`:

```yaml
name: Upload to Kiwi TCMS

on:
  workflow_dispatch:
    inputs:
      results_file:
        description: 'Path to test results file'
        required: true
        default: 'vitest-results.json'

jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Upload to Kiwi TCMS
        run: |
          npx tsx scripts/kiwi-upload-rest.ts \
            --file ${{ github.event.inputs.results_file }} \
            --auto-create-cases
        env:
          KIWI_URL: ${{ secrets.KIWI_URL }}
          KIWI_USERNAME: ${{ secrets.KIWI_USERNAME }}
          KIWI_PASSWORD: ${{ secrets.KIWI_PASSWORD }}
          KIWI_TEST_PLAN_ID: ${{ secrets.KIWI_TEST_PLAN_ID }}
```

## Resolução de Problemas

### Erro: "XML-RPC fault -32603: Unknown error"

Verifique se os campos obrigatórios estão sendo enviados corretamente:
- `summary` - Nome do caso de teste
- `case_status` - Status do caso (1 = PROPOSED)
- `priority` - Prioridade (1 = P1)
- `product` - ID do produto
- `category` - ID da categoria

### Erro: "Authentication failed"

Verifique as credenciais em `KIWI_USERNAME` e `KIWI_PASSWORD`.

### Erro: "Product not found"

Especifique o produto usando `--product-id` ou `--product-name`.

###many test cases not found

Use a flag `--auto-create-cases` para criar automaticamente casos de teste que não existem no Kiwi TCMS.

## Licença

MIT
