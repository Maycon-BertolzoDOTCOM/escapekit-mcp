# 🔍 Guia de Diagnóstico: Logs de Debug Adicionados ao Script

## O Que Foi Feito

Adicionei logs de debug detalhados ao script `scripts/kiwi-upload-enhanced.mts` para identificar exatamente onde o problema com a `KIWI_URL` está ocorrendo.

**Commit**: `48d0711` - debug: adicionar logs detalhados para diagnosticar problema KIWI_URL

## Logs de Debug Adicionados

### 1. Variáveis de Ambiente (No início do script)

```
🔍 DEBUG: Environment variables:
  KIWI_URL exists: true/false
  KIWI_URL value: https://paulita-unbreathed-blair.ngrok-free.dev
  KIWI_USERNAME exists: true/false
  KIWI_PASSWORD exists: ***/false
```

### 2. Conteúdo Bruto do Arquivo de Config

```
🔍 DEBUG: Raw config file content:
{
  "baseUrl": "${KIWI_URL}",
  "username": "${KIWI_USERNAME}",
  "password": "${KIWI_PASSWORD}",
  ...
}
```

### 3. Config Antes da Substituição

```
🔍 DEBUG: Parsed config before substitution:
{
  "baseUrl": "${KIWI_URL}",
  "username": "${KIWI_USERNAME}",
  "password": "${KIWI_PASSWORD}",
  ...
}
```

### 4. Processo de Substituição (Passo a Passo)

```
🔍 DEBUG: Starting environment variable substitution...
  Replacing ${KIWI_URL} with "https://paulita-unbreathed-blair.ngrok-free.dev"
  Replacing ${KIWI_USERNAME} with "seu-usuario"
  Replacing ${KIWI_PASSWORD} with "sua-senha"
  Replacing ${KIWI_PRODUCT_NAME} with "EscapeKit"
```

### 5. Config Depois da Substituição

```
🔍 DEBUG: Config after substitution:
{
  "baseUrl": "https://paulita-unbreathed-blair.ngrok-free.dev",
  "username": "seu-usuario",
  "password": "sua-senha",
  ...
}
```

### 6. Config Fallback (Se o arquivo não for encontrado)

```
✗ Failed to load configuration: ENOENT: no such file or directory
Using environment variables...
🔍 DEBUG: Using fallback config
  KIWI_URL from env: https://paulita-unbreathed-blair.ngrok-free.dev
🔍 DEBUG: Fallback config baseUrl: https://paulita-unbreathed-blair.ngrok-free.dev
```

## Como Executar o Workflow com os Novos Logs

### Passo 1: Atualizar a Secret KIWI_URL (Se ainda não fez)

1. Acesse: https://github.com/safevisionb-dotcom/escapekit-mcp/settings/secrets/actions
2. Encontre `KIWI_URL` e clique em "Update"
3. Cole: `https://paulita-unbreathed-blair.ngrok-free.dev`
4. Clique em "Update secret"

### Passo 2: Executar o Workflow Manualmente

1. Vá para: https://github.com/safevisionb-dotcom/escapekit-mcp/actions
2. Selecione: "Upload Test Results to Kiwi TCMS"
3. Clique em: "Run workflow" → branch: `phase3-ci-cd-test`
4. Clique no botão verde "Run workflow"

### Passo 3: Analisar os Logs de Debug

Expanda o step "Upload results to Kiwi TCMS" e procure pelos logs com `🔍 DEBUG:`.

## Análise dos Possíveis Cenários

### Cenário 1: Variável de Ambiente Não Definida

**Log esperado:**
```
🔍 DEBUG: Environment variables:
  KIWI_URL exists: false
  KIWI_URL value: undefined
```

**Diagnóstico:** A secret `KIWI_URL` não está sendo passada para o step do workflow.

**Solução:** Verificar se a secret está definida no workflow:
```yaml
- name: Upload results to Kiwi TCMS
  env:
    KIWI_URL: ${{ secrets.KIWI_URL }}
```

### Cenário 2: Variável de Ambiente Definida, mas Substituição Falha

**Log esperado:**
```
🔍 DEBUG: Environment variables:
  KIWI_URL exists: true
  KIWI_URL value: https://paulita-unbreathed-blair.ngrok-free.dev

🔍 DEBUG: Raw config file content:
{
  "baseUrl": "${KIWI_URL}",
  ...
}

🔍 DEBUG: Starting environment variable substitution...
  Replacing ${KIWI_URL} with "https://paulita-unbreathed-blair.ngrok-free.dev"

🔍 DEBUG: Config after substitution:
{
  "baseUrl": "https://paulita-unbreathed-blair.ngrok-free.dev",
  ...
}

✓ Loaded configuration from config/kiwi-tcms.json
  baseUrl: https://kiwi-tcms.seudominio.com  <-- INCORRETO!
```

**Diagnóstico:** A substituição está funcionando, mas o valor final ainda está errado. Isso sugere que há outro lugar no código que está sobrescrevendo o valor.

**Solução:** Procurar no código onde `config.baseUrl` é alterado após o carregamento.

### Cenário 3: Config Fallback Sendo Usado

**Log esperado:**
```
✗ Failed to load configuration: ENOENT: no such file or directory
Using environment variables...
🔍 DEBUG: Using fallback config
  KIWI_URL from env: https://paulita-unbreathed-blair.ngrok-free.dev
🔍 DEBUG: Fallback config baseUrl: https://kiwi.example.com  <-- INCORRETO!
```

**Diagnóstico:** O arquivo de config não está sendo encontrado, e o fallback está usando um valor hardcoded incorreto.

**Solução:** Verificar se o arquivo `config/kiwi-tcms.json` existe no repositório.

### Cenário 4: Tudo Correto, Mas Ainda Tem Erro de DNS

**Log esperado:**
```
🔍 DEBUG: Environment variables:
  KIWI_URL exists: true
  KIWI_URL value: https://paulita-unbreathed-blair.ngrok-free.dev

🔍 DEBUG: Starting environment variable substitution...
  Replacing ${KIWI_URL} with "https://paulita-unbreathed-blair.ngrok-free.dev"

✓ Loaded configuration from config/kiwi-tcms.json
  baseUrl: https://paulita-unbreathed-blair.ngrok-free.dev  <-- CORRETO!

Authenticating to Kiwi TCMS...
Error: getaddrinfo ENOTFOUND kiwi-tcms.seudominio.com  <-- AINDA ERRADO!
```

**Diagnóstico:** A config está correta, mas o erro ainda acontece em outro lugar. Provavelmente o erro não está relacionado à URL, mas a algo mais abaixo no código.

**Solução:** Adicionar mais logs para rastrear onde o erro de DNS está ocorrendo.

## Interpretação dos Logs

### Se Vir: `KIWI_URL exists: false`
- **Problema**: A secret não está sendo passada para o step
- **Verificar**: Workflow `.github/workflows/kiwi-tcms.yml` linha 35
- **Correção**: Adicionar `KIWI_URL: ${{ secrets.KIWI_URL }}` no bloco `env:`

### Se Vir: `KIWI_URL exists: true` mas `KIWI_URL value: undefined`
- **Problema**: A secret existe mas está vazia
- **Verificar**: Configuração da secret no GitHub
- **Correção**: Recriar a secret com o valor correto

### Se Vir: `Replacing ${KIWI_URL} with "undefined"`
- **Problema**: A variável de ambiente não está disponível no contexto do script
- **Verificar**: Escopo da variável no workflow
- **Correção**: Garantir que a variável está no bloco `env:` correto

### Se Vir: `baseUrl: https://kiwi-tcms.seudominio.com`
- **Problema**: A substituição não funcionou ou foi sobrescrita
- **Verificar**: Se há código modificando `config.baseUrl` depois do carregamento
- **Correção**: Remover ou corrigir o código que sobrescreve o valor

### Se Vir: `baseUrl: https://paulita-unbreathed-blair.ngrok-free.dev` mas ainda tem erro DNS
- **Problema**: O erro não está relacionado à URL config
- **Verificar**: Se o KiwiXmlRpcClient está usando a config corretamente
- **Correção**: Adicionar logs no construtor do KiwiXmlRpcClient

## Próximos Passos Após Executar o Workflow

### 1. Copie os Logs de Debug

Copie toda a seção de logs do step "Upload results to Kiwi TCMS", desde o `🚀 Starting Kiwi TCMS upload...` até onde ocorre o erro.

### 2. Analise os Logs

Use os cenários acima para identificar onde está o problema.

### 3. Relate os Resultados

Compartilhe os logs comigo para análise. Inclua:

- Todos os logs com `🔍 DEBUG:`
- A linha onde o erro ocorre
- O erro completo (stack trace se disponível)

### 4. Aplicar a Correção

Com base na análise, aplicarei a correção apropriada.

## Exemplo de Diagnóstico Completo

### Log Completo com Sucesso

```
🚀 Starting Kiwi TCMS upload via XML-RPC...
🔍 DEBUG: Environment variables:
  KIWI_URL exists: true
  KIWI_URL value: https://paulita-unbreathed-blair.ngrok-free.dev
  KIWI_USERNAME exists: true
  KIWI_PASSWORD exists: ***

🔍 DEBUG: Raw config file content:
{
  "baseUrl": "${KIWI_URL}",
  "username": "${KIWI_USERNAME}",
  "password": "${KIWI_PASSWORD}",
  "defaultProduct": "EscapeKit",
  "defaultPlanId": 1,
  "testRunTemplate": "AutoTest-{DATE}",
  "timeout": 5000,
  "retries": 3
}

🔍 DEBUG: Parsed config before substitution:
{
  "baseUrl": "${KIWI_URL}",
  "username": "${KIWI_USERNAME}",
  "password": "${KIWI_PASSWORD}",
  "defaultProduct": "EscapeKit",
  "defaultPlanId": 1,
  "testRunTemplate": "AutoTest-{DATE}",
  "timeout": 5000,
  "retries": 3
}

🔍 DEBUG: Starting environment variable substitution...
  Replacing ${KIWI_URL} with "https://paulita-unbreathed-blair.ngrok-free.dev"
  Replacing ${KIWI_USERNAME} with "admin"
  Replacing ${KIWI_PASSWORD} with "***"

🔍 DEBUG: Config after substitution:
{
  "baseUrl": "https://paulita-unbreathed-blair.ngrok-free.dev",
  "username": "admin",
  "password": "***",
  "defaultProduct": "EscapeKit",
  "defaultPlanId": 1,
  "testRunTemplate": "AutoTest-{DATE}",
  "timeout": 5000,
  "retries": 3
}

✓ Loaded configuration from config/kiwi-tcms.json
  baseUrl: https://paulita-unbreathed-blair.ngrok-free.dev

✓ Loaded 1145 test results

Test Statistics:
   Total: 1145
   Passed: 1120 (97.82%)
   Failed: 25
   Skipped: 0

Authenticating to Kiwi TCMS...
✓ Authentication successful

Looking up product...
✓ Found product by ID: EscapeKit (ID: 1)

...
```

## Checklist para Diagnóstico

- [ ] Atualizei a secret KIWI_URL no GitHub
- [ ] Executei o workflow manualmente
- [ ] Copiei os logs de debug completos
- [ ] Identifiquei qual cenário se aplica
- [ ] Compartilhei os logs para análise

## Solução Temporária: Passar URL Diretamente

Se quiser testar imediatamente sem depender da secret, você pode modificar o workflow temporariamente:

```yaml
- name: Upload results to Kiwi TCMS
  env:
    KIWI_URL: https://paulita-unbreathed-blair.ngrok-free.dev  # Hardcoded temporariamente
    KIWI_USERNAME: ${{ secrets.KIWI_USERNAME }}
    KIWI_PASSWORD: ${{ secrets.KIWI_PASSWORD }}
```

**⚠️ Atenção**: Isso expõe a URL nos logs do workflow. Use apenas para testes!

## Resumo

Os logs de debug adicionados mostrarão exatamente:

1. ✅ Se as variáveis de ambiente estão definidas
2. ✅ Qual é o valor de cada variável
3. ✅ O conteúdo do arquivo de config
4. ✅ Como a substituição está sendo feita
5. ✅ O resultado final após a substituição
6. ✅ Se o fallback está sendo usado

Execute o workflow, copie os logs, e compartilhe para análise!

---

**Data**: 2026-03-19
**Status**: 🟡 Aguardando execução do workflow com logs de debug
**Próxima ação**: Executar workflow manualmente e analisar logs de debug
**Commit de referência**: `48d0711`