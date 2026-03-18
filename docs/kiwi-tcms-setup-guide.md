# Guia de Setup do Kiwi TCMS para EscapeKit

Este guia orienta você na configuração do Kiwi TCMS para monitoramento de testes do EscapeKit.

## Índice

- [Pré-requisitos](#pré-requisitos)
- [Opções de Instalação](#opções-de-instalação)
- [Instalação via Docker (Recomendado)](#instalação-via-docker-recomendado)
- [Configuração Inicial](#configuração-inicial)
- [Upload de Resultados de Testes](#upload-de-resultados-de-testes)
- [Solução de Problemas](#solução-de-problemas)

---

## Pré-requisitos

- Docker e Docker Compose instalados
- Node.js 18+ e npm
- Acesso ao repositório do EscapeKit

---

## Opções de Instalação

### Opção 1: Docker Local (Recomendado para Desenvolvimento)
- ✅ Fácil setup e manutenção
- ✅ Sem custos
- ✅ Controle total
- ❌ Requer servidor dedicado para produção

### Opção 2: Kiwi TCMS Cloud (SaaS)
- ✅ Sem manutenção de infraestrutura
- ✅ Alta disponibilidade
- ❌ Custos mensais
- ❌ Menos controle

Este guia usa a **Opção 1 (Docker Local)**.

---

## Instalação via Docker (Recomendado)

### Passo 1: Executar o Script de Setup

O projeto inclui um script automatizado para setup do Kiwi TCMS:

```bash
# Tornar o script executável
chmod +x scripts/kiwi-setup.sh

# Executar o script
./scripts/kiwi-setup.sh
```

O script irá:
1. ✅ Verificar se Docker e Docker Compose estão instalados
2. ✅ Criar arquivo `docker-compose.kiwi.yml`
3. ✅ Iniciar containers do Kiwi TCMS e PostgreSQL
4. ✅ Aguardar o serviço ficar pronto
5. ✅ Criar arquivo de configuração `config/kiwi-tcms.json`

### Passo 2: Verificar se o Kiwi TCMS está Rodando

Após o script completar, acesse:
```
http://localhost:8080
```

Você deve ver a página de login do Kiwi TCMS.

### Passo 3: Fazer Login

Use as credenciais padrão (apenas para primeira vez):
- **Username**: `admin`
- **Password**: `admin`

⚠️ **IMPORTANTE**: Mude a senha imediatamente!

**Para mudar a senha:**
1. Faça login
2. Vá para `Administration` > `Change Password`
3. Digite a nova senha e confirme
4. Salve

---

## Configuração Inicial

### Passo 1: Criar o Produto "EscapeKit"

1. No menu lateral, clique em **Products**
2. Clique no botão **New Product**
3. Preencha:
   - **Name**: `EscapeKit`
   - **Description**: `Sistema de transformação de código AI sandbox para produção`
4. Clique em **Save**

5. Anote o **Product ID** (geralmente 1). Você precisará dele depois.

### Passo 2: Criar um Plano de Testes

1. No menu lateral, clique em **Test Plans**
2. Clique no botão **New Test Plan**
3. Preencha:
   - **Product**: `EscapeKit`
   - **Name**: `Main Test Plan`
   - **Description**: `Plano principal de testes do EscapeKit`
4. Clique em **Save**

5. Anote o **Test Plan ID** (geralmente 1). Você precisará dele depois.

### Passo 3: Atualizar o Arquivo de Configuração

Edite o arquivo `config/kiwi-tcms.json`:

```json
{
  "baseUrl": "http://localhost:8080",
  "username": "admin",
  "password": "sua_nova_senha",
  "defaultProduct": "EscapeKit",
  "defaultPlanId": 1,  // ← Atualize com o Test Plan ID
  "testRunTemplate": "AutoTest-{DATE}",
  "timeout": 5000,
  "retries": 3
}
```

Certifique-se de:
- ✅ `defaultPlanId` tem o valor correto do seu Test Plan ID
- ✅ `password` tem sua nova senha (não a padrão!)

---

## Upload de Resultados de Testes

### Opção 1: Upload Manual (Para Testes)

Depois de executar os testes:

```bash
# Executar testes
npm test

# Upload manual para Kiwi TCMS
npx ts-node scripts/kiwi-upload.ts --file vitest-results.json
```

### Opção 2: Upload Automático via CI/CD

O workflow `.github/workflows/kiwi-tcms.yml` já está configurado para upload automático. Para habilitá-lo:

1. Vá ao repositório no GitHub
2. Acesse **Settings** > **Secrets and variables** > **Actions**
3. Adicione os seguintes secrets:
   - `KIWI_URL`: `http://localhost:8080` (ou URL da sua instância)
   - `KIWI_USERNAME`: Seu nome de usuário
   - `KIWI_PASSWORD`: Sua senha
   - `KIWI_PRODUCT_ID`: ID do produto EscapeKit
   - `KIWI_TEST_PLAN_ID`: ID do seu plano de testes

4. Faça um push para o branch `main` ou `develop`
5. O upload será automático após cada execução de testes

---

## Upload de Resultados de Testes

### Estrutura do Upload

O script `scripts/kiwi-upload.ts` segue este fluxo:

```
1. Carregar resultados de teste (vitest-results.json)
   ↓
2. Calcular estatísticas (passados, falhados, ignorados)
   ↓
3. Autenticar com Kiwi TCMS
   ↓
4. Criar um Test Run novo
   ↓
5. Para cada teste:
   - Criar Test Case (se não existir)
   - Criar Test Execution
   - Definir status (PASSED, FAILED, IDLE)
   ↓
6. Exibir resumo final
```

### Estrutura dos Resultados

Cada resultado de teste é mapeado para:

| Campo Vitest | Campo Kiwi TCMS |
|-------------|----------------|
| `testCase` | `TestCase.name` |
| `outcome` | `TestExecution.status` (PASSED/FAILED/IDLE) |
| `duration` | `TestExecution.duration` |
| `error` | `TestExecution.notes` |

### Exemplo de Saída

```
🚀 Starting Kiwi TCMS upload...
✓ Loaded configuration from config/kiwi-tcms.json
✓ Loaded 1121 test results

📊 Test Statistics:
   Total: 1121
   Passed: 1089 (97.14%)
   Failed: 32
   Skipped: 0

✓ Authentication successful
✓ Test run created: 123
  ✓ Uploaded: ASTTransformer.test.ts (passed)
  ✓ Uploaded: CodeAnalyzer.test.ts (passed)
  ✓ Uploaded: ImportDetector.test.ts (failed)
  ...

✓ Upload complete: 1121 successful, 0 failed

✅ Upload complete! Test run ID: 123
📊 View results at: http://localhost:8080/runs/123
```

---

## Solução de Problemas

### Problema: "Kiwi TCMS authentication failed"

**Solução:**
1. Verifique se o usuário e senha estão corretos em `config/kiwi-tcms.json`
2. Certifique-se de que o Kiwi TCMS está rodando (`docker ps | grep kiwi`)
3. Tente fazer login manualmente via browser

### Problema: "Failed to create test run"

**Solução:**
1. Verifique se o `defaultPlanId` está correto
2. Certifique-se de que o produto e plano de testes existem
3. Verifique os logs do Kiwi TCMS: `docker logs kiwi-tcms-escapekit`

### Problema: "Container não inicia"

**Solução:**
1. Verifique se a porta 8080 está em uso: `lsof -i :8080`
2. Se estiver, mude a porta no `docker-compose.kiwi.yml` e no arquivo de configuração
3. Verifique os logs: `docker compose -f docker-compose.kiwi.yml logs`

### Problema: "Upload muito lento"

**Solução:**
1. Teste com um número menor de resultados primeiro
2. Aumente o `timeout` em `config/kiwi-tcms.json`
3. Verifique a conexão de rede com o Kiwi TCMS

### Problema: "Results not showing in dashboard"

**Solução:**
1. Verifique se o upload foi bem-sucedido (olhe o console output)
2. Atualize a página do dashboard
3. Verifique os filtros (data, produto, plano)
4. Vá direto à URL do Test Run se fornecida no output

---

## Comandos Úteis

### Gerenciar Containers Docker

```bash
# Ver status dos containers
docker compose -f docker-compose.kiwi.yml ps

# Ver logs
docker compose -f docker-compose.kiwi.yml logs -f kiwi-tcms

# Parar containers
docker compose -f docker-compose.kiwi.yml down

# Reiniciar containers
docker compose -f docker-compose.kiwi.yml restart

# Parar e remover volumes (reset completo)
docker compose -f docker-compose.kiwi.yml down -v
```

### Testar Conexão

```bash
# Testar se Kiwi TCMS está respondendo
curl http://localhost:8080

# Testar API de autenticação
curl -X POST http://localhost:8080/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

### Upload de Testes

```bash
# Upload com verbose
npx ts-node scripts/kiwi-upload.ts --file vitest-results.json --verbose

# Upload com plano de testes específico
npx ts-node scripts/kiwi-upload.ts \
  --file vitest-results.json \
  --test-plan-id 5

# Upload dry-run (não envia dados, apenas mostra)
npx ts-node scripts/kiwi-upload.ts \
  --file vitest-results.json \
  --dry-run
```

---

## Próximos Passos

Após completar o setup básico:

1. ✅ **Criar Dashboards** (Fase 4, Tarefa 3)
   - Dashboard de Taxa de Aprovação
   - Dashboard de Distribuição de Falhas
   - Dashboard de Performance

2. ✅ **Configurar Alertas** (Fase 4, Tarefa 4)
   - Alertas de Slack
   - Alertas de qualidade
   - Alertas de regressão

3. ✅ **Integrar com CI/CD** (Fase 4, Tarefa 13)
   - Upload automático após cada build
   - Comentários em PRs
   - Bloqueio de merges

4. ✅ **Documentar Uso** (Fase 4, Tarefa 16)
   - Guia de usuários
   - Playbooks de incidentes
   - Exemplos de uso

---

## Recursos Adicionais

- **Kiwi TCMS Documentation**: https://kiwitcms.readthedocs.io/
- **Kiwi TCMS API**: http://localhost:8080/api/
- **EscapeKit Repository**: https://github.com/safevisionb-dotcom/escapekit-mcp

---

## Suporte

Se encontrar problemas:
1. Consulte a seção de [Solução de Problemas](#solução-de-problemas)
2. Verifique os logs do Docker: `docker logs kiwi-tcms-escapekit`
3. Consulte a documentação oficial do Kiwi TCMS
4. Abra uma issue no repositório do EscapeKit

---

**Última atualização**: 2026-03-17  
**Versão**: 1.0.0  
**Fase**: Fase 4 - Monitoramento e Alertas