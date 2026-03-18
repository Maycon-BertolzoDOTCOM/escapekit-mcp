# Guia de Alertas do Kiwi TCMS

Este guia explica como configurar alertas automáticos no Kiwi TCMS para notificações sobre qualidade de testes do EscapeKit.

## Índice

- [Visão Geral](#visão-geral)
- [Tipos de Alertas](#tipos-de-alertas)
- [Configuração de Slack](#configuração-de-slack)
- [Configuração de Discord](#configuração-de-discord)
- [Configuração de E-mail](#configuração-de-e-mail)
- [Regras de Alerta](#regras-de-alerta)
- [Testando Alertas](#testando-alertas)
- [Melhores Práticas](#melhores-práticas)

---

## Visão Geral

O sistema de alertas do Kiwi TCMS permite notificar automaticamente a equipe sobre:

- 🔴 **Quedas de qualidade** - Taxa de aprovação abaixo do threshold
- ⚡ **Degradação de performance** - Aumento no tempo de execução
- 🔄 **Regressões** - Novas falhas em testes que passavam
- 🔥 **Falhas críticas** - Erros em módulos importantes

### Fluxo de Alertas

```
Execução de Testes (CI/CD)
    ↓
Upload para Kiwi TCMS
    ↓
Análise de Métricas
    ↓
Verificação de Thresholds
    ↓
Disparo de Alertas (se necessário)
    ↓
Envio para Canais (Slack/Discord/Email)
    ↓
Criação Automática de Issues (críticos)
```

---

## Tipos de Alertas

### 1. Alertas de Qualidade

#### Taxa de Aprovação Baixa

**Descrição**: Taxa de aprovação caiu abaixo do threshold

**Thresholds**:
- 🟡 **Warning**: < 95% de aprovação
- 🔴 **Critical**: < 90% de aprovação

**Mensagem de Exemplo**:
```
⚠️ ALERTA: Taxa de Aprovação Baixa

Projeto: EscapeKit
Build: #1234 (commit: abc1234)
Taxa de Aprovação: 88.5%
Threshold: 95%
Delta: -6.5% vs build anterior

Ação Necessária: Investigar falhas e corrigir antes do merge.

📊 Detalhes: http://localhost:8080/runs/1234
```

#### Queda Significativa

**Descrição**: Queda de mais de 5% em relação ao build anterior

**Thresholds**:
- 🔴 **Critical**: Queda > 5%

**Mensagem de Exemplo**:
```
🚨 ALERTA CRÍTICO: Queda Significativa de Qualidade

Projeto: EscapeKit
Build: #1234 (commit: abc1234)
Taxa de Aprovação: 91.2%
Build Anterior: 97.5%
Delta: -6.3% 📉

Ação Imediata: Investigar regressões recentes!

🔥 Falhas Críticas:
  • SecurityValidator.test.ts: FAILED
  • ImportDetector.test.ts: FAILED
  • RateLimiter.test.ts: FAILED

📊 Detalhes: http://localhost:8080/runs/1234
```

### 2. Alertas de Performance

#### Aumento de Tempo de Execução

**Descrição**: Tempo de execução aumentou significativamente

**Thresholds**:
- 🟡 **Warning**: Aumento > 20%
- 🔴 **Critical**: Aumento > 50% ou tempo > 15 min

**Mensagem de Exemplo**:
```
⚠️ ALERTA: Degradação de Performance

Projeto: EscapeKit
Build: #1234
Tempo Atual: 8.5 min
Build Anterior: 6.2 min
Delta: +37% 📈

Ação: Investigar testes que aumentaram tempo.

🐌 Testes Lentos:
  • DeepDependencyScanner.test.ts: 45s
  • TransformationPipeline.test.ts: 38s
  • E2EValidator.test.ts: 32s

📊 Detalhes: http://localhost:8080/runs/1234
```

#### Testes Muito Lentos

**Descrição**: Testes individuais ultrapassam o tempo limite

**Thresholds**:
- 🟡 **Warning**: > 10s
- 🔴 **Critical**: > 30s

**Mensagem de Exemplo**:
```
⚠️ ALERTA: Teste Muito Lento

Projeto: EscapeKit
Teste: DeepDependencyScanner.test.ts
Tempo de Execução: 45.2s
Threshold: 10s

Ação: Otimizar ou mover para suite de integração.

📊 Detalhes: http://localhost:8080/testcases/456
```

### 3. Alertas de Regressão

#### Nova Falha

**Descrição**: Teste que passava agora falha

**Thresholds**:
- 🔴 **Critical**: Qualquer nova falha

**Mensagem de Exemplo**:
```
🚨 ALERTA CRÍTICO: Nova Regressão Detectada

Projeto: EscapeKit
Teste: SecurityValidator.test.ts
Build: #1234 (commit: abc1234)
Status: FAILED
Status Anterior: PASSED

Ação Imediata: Investigar mudanças recentes!

Erro: Expected security check to pass, but failed

🔍 Commit Responsável: https://github.com/.../commit/abc1234
📊 Detalhes: http://localhost:8080/runs/1234
🐛 Issue Criada: https://github.com/.../issues/567
```

#### Flaky Test

**Descrição**: Teste alternando entre sucesso e falha

**Thresholds**:
- 🟡 **Warning**: 2 alternâncias em 5 builds
- 🔴 **Critical**: 3+ alternâncias em 5 builds

**Mensagem de Exemplo**:
```
⚠️ ALERTA: Flaky Test Detectado

Projeto: EscapeKit
Teste: RateLimiter.test.ts
Histórico: PASS, FAIL, PASS, FAIL, PASS
Frequência: 2 falhas em 5 builds

Ação: Investigar causa raiz e estabilizar teste.

Possíveis Causas:
  • Race condition
  • Falta de isolamento
  • Dependência de recursos externos

📊 Detalhes: http://localhost:8080/testcases/789
```

### 4. Alertas de Módulos Críticos

#### Falha em Módulo Crítico

**Descrição**: Falha em módulos considerados críticos (security, core, etc.)

**Thresholds**:
- 🔴 **Critical**: Qualquer falha em módulo crítico

**Mensagem de Exemplo**:
```
🚨 ALERTA CRÍTICO: Falha em Módulo de Segurança

Projeto: EscapeKit
Módulo: Security
Teste: SecurityValidator.test.ts
Build: #1234
Status: FAILED

Ação Imediata: Esta falha afeta segurança do sistema!

Erro: Vulnerability detected in dependency

🔥 Prioridade: ALTA
🐛 Issue Criada: https://github.com/.../issues/567
📊 Detalhes: http://localhost:8080/runs/1234
```

---

## Configuração de Slack

### Passo 1: Criar Webhook do Slack

1. Acesse https://api.slack.com/apps
2. Clique em **Create New App**
3. Nome: `EscapeKit Alerts`
4. Workspace: Selecione seu workspace
5. Clique em **Incoming Webhooks**
6. Ative "Incoming Webhooks"
7. Clique em **Add New Webhook to Workspace**
8. Selecione o canal `#escapekit-alerts` (ou crie um novo)
9. Copie a **Webhook URL** (começa com `https://hooks.slack.com/services/...`)

### Passo 2: Configurar no Kiwi TCMS

1. Acesse o Kiwi TCMS: http://localhost:8080
2. Vá para **Administration** > **Notifications**
3. Clique em **Add Notification Channel**
4. Configure:

```yaml
Name: Slack Alerts
Type: Webhook
URL: https://hooks.slack.com/services/XXX/YYY/ZZZ
Method: POST
Headers:
  Content-Type: application/json
Body Template: |
  {
    "text": "${ALERT_MESSAGE}",
    "attachments": [
      {
        "color": "${ALERT_COLOR}",
        "fields": [
          {
            "title": "Project",
            "value": "EscapeKit",
            "short": true
          },
          {
            "title": "Build",
            "value": "${BUILD_ID}",
            "short": true
          },
          {
            "title": "Pass Rate",
            "value": "${PASS_RATE}%",
            "short": true
          },
          {
            "title": "Threshold",
            "value": "${THRESHOLD}%",
            "short": true
          }
        ],
        "actions": [
          {
            "type": "button",
            "text": "View Details",
            "url": "${BUILD_URL}"
          }
        ]
      }
    ]
  }
```

5. Clique em **Save**

### Passo 3: Testar Integração

Envie um teste manual:

```bash
curl -X POST https://hooks.slack.com/services/XXX/YYY/ZZZ \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "🧪 Teste de Alerta do EscapeKit",
    "attachments": [
      {
        "color": "good",
        "text": "Integração com Slack funcionando!"
      }
    ]
  }'
```

### Passo 4: Criar Regras de Alerta

1. Vá para **Dashboards** > **Alert Rules**
2. Clique em **Add Alert Rule**
3. Configure:

```yaml
Name: Pass Rate Below 95%
Description: Alert when test pass rate drops below 95%
Metric: pass_rate
Operator: less_than
Threshold: 95
Severity: warning
Channel: Slack Alerts
```

4. Repita para outros thresholds:
- Pass Rate Below 90% (critical)
- Performance Degradation > 20% (warning)
- Performance Degradation > 50% (critical)
- New Regression (critical)

---

## Configuração de Discord

### Passo 1: Criar Webhook do Discord

1. Vá ao servidor do Discord
2. Clique em **Configurações do Servidor** (engrenagem)
3. Vá para **Integrações** > **Webhooks**
4. Clique em **Novo Webhook**
5. Nome: `EscapeKit Alerts`
6. Canal: `#escapekit-alerts` (ou crie um novo)
7. Copie a **Webhook URL**
8. Clique em **Salvar**

### Passo 2: Configurar no Kiwi TCMS

Similar ao Slack, mas com body template específico para Discord:

```json
{
  "content": "${ALERT_MESSAGE}",
  "embeds": [
    {
      "title": "${ALERT_TITLE}",
      "description": "${ALERT_DESCRIPTION}",
      "color": ${ALERT_COLOR_DECIMAL},
      "fields": [
        {
          "name": "Build",
          "value": "${BUILD_ID}",
          "inline": true
        },
        {
          "name": "Pass Rate",
          "value": "${PASS_RATE}%",
          "inline": true
        }
      ],
      "url": "${BUILD_URL}"
    }
  ]
}
```

### Cores para Discord

```javascript
const colors = {
  good: 3066993,      // Verde
  warning: 15844367,  // Amarelo
  critical: 15158332  // Vermelho
};
```

---

## Configuração de E-mail

### Passo 1: Configurar SMTP

No Kiwi TCMS:

1. Vá para **Administration** > **Settings**
2. Configure:

```yaml
Email Server: smtp.gmail.com
Email Port: 587
Email Use TLS: true
Email Host User: your-email@gmail.com
Email Host Password: your-app-password
Email From: escapekit-alerts@example.com
```

### Passo 2: Criar Lista de Distribuição

```yaml
Team Alerts:
  - developer1@example.com
  - developer2@example.com

Critical Alerts:
  - lead@example.com
  - manager@example.com
  - security@example.com

Daily Summary:
  - team@example.com
  - manager@example.com
```

### Passo 3: Configurar Template de E-mail

```yaml
Subject: "[${SEVERITY}] EscapeKit Alert: ${ALERT_TITLE}"

Body: |
  <html>
  <body>
    <h2>${ALERT_TITLE}</h2>
    <p>${ALERT_MESSAGE}</p>
    
    <table>
      <tr>
        <td><strong>Build:</strong></td>
        <td>${BUILD_ID}</td>
      </tr>
      <tr>
        <td><strong>Pass Rate:</strong></td>
        <td>${PASS_RATE}%</td>
      </tr>
      <tr>
        <td><strong>Threshold:</strong></td>
        <td>${THRESHOLD}%</td>
      </tr>
    </table>
    
    <p>
      <a href="${BUILD_URL}">View Details</a>
    </p>
  </body>
  </html>
```

---

## Regras de Alerta

### Thresholds Recomendados

#### Alertas de Qualidade

| Métrica | Warning | Critical | Ação |
|---------|---------|----------|------|
| Pass Rate | < 95% | < 90% | Investigar falhas |
| Delta vs Anterior | < -5% | < -10% | Verificar regressões |
| Falhas em Módulos Críticos | Any | Any | Priorizar correção |

#### Alertas de Performance

| Métrica | Warning | Critical | Ação |
|---------|---------|----------|------|
| Tempo Total | > 10 min | > 15 min | Otimizar |
| Aumento | > 20% | > 50% | Investigar |
| Teste Individual | > 10s | > 30s | Otimizar ou mover |

#### Alertas de Regressão

| Métrica | Warning | Critical | Ação |
|---------|---------|----------|------|
| Nova Falha | Any | Any | Investigar commit |
| Flaky Test (5 builds) | 2 | 3+ | Estabilizar |
| Falhas Recorrentes | 3+ | 5+ | Corrigir definitivamente |

### Cooldowns

Para evitar spam de alertas:

```yaml
Same Alert: 30 min cooldown
Same Test: 1 hour cooldown
Same Module: 2 hours cooldown
Critical Alerts: No cooldown (sempre notificar)
```

---

## Testando Alertas

### Teste Manual

Use o script de teste:

```bash
# Testar alerta de qualidade baixa
npx ts-node scripts/test-alerts.ts \
  --type quality \
  --severity critical \
  --pass-rate 88.5

# Testar alerta de performance
npx ts-node scripts/test-alerts.ts \
  --type performance \
  --severity warning \
  --delta 35

# Testar alerta de regressão
npx ts-node scripts/test-alerts.ts \
  --type regression \
  --severity critical \
  --test "SecurityValidator.test.ts"
```

### Teste com Build Real

1. Faça uma mudança proposital para falhar um teste
2. Faça commit e push
3. Aguarde o CI/CD executar
4. Verifique se o alerta foi enviado
5. Reverta a mudança

### Verificar Logs

```bash
# Logs do Kiwi TCMS
docker logs kiwi-tcms-escapekit -f

# Logs de alertas
docker logs kiwi-tcms-escapekit | grep ALERT

# Logs de webhooks
docker logs kiwi-tcms-escapekit | grep webhook
```

---

## Melhores Práticas

### 1. Níveis de Severidade

- 🔴 **Critical**: Ação imediata, notificar todos
- 🟡 **Warning**: Investigar em breve, notificar equipe
- 🔵 **Info**: Apenas registro, sem notificação

### 2. Mensagens Claras

✅ **Bom**:
```
🚨 Taxa de aprovação abaixo de 95%
Atual: 88.5% (-6.5%)
Build: #1234
Ação: Corrigir antes de fazer merge
```

❌ **Ruim**:
```
Alerta: taxa baixa
88.5%
```

### 3. Links para Ação

Sempre incluir links para:
- 📊 Dashboard detalhado
- 🔗 Build específico
- 🐛 Issue criada
- 🔍 Commit responsável

### 4. Evitar Spam

- Usar cooldowns apropriados
- Agregar alertas similares
- Enviar resumos diários para não-críticos
- Distinguir entre regressões e flaky tests

### 5. Feedback Loop

- Monitorar tempo de resposta a alertas
- Ajustar thresholds conforme necessário
- Remover alertas que são ignorados
- Adicionar novos alertas conforme necessário

---

## Solução de Problemas

### Problema: Alertas não são enviados

**Solução**:
1. Verifique configuração de webhook
2. Teste webhook manualmente
3. Verifique logs do Kiwi TCMS
4. Verifique regras de alerta

### Problema: Muitos alertas falsos positivos

**Solução**:
1. Ajuste thresholds
2. Adicione cooldowns
3. Melhore detecção de flaky tests
4. Adicione filtros por módulo

### Problema: Alertas chegam muito tarde

**Solução**:
1. Verifique latência de upload
2. Otimize queries do dashboard
3. Use webhooks para atualização imediata
4. Monitore tempo de processamento

---

## Próximos Passos

Após configurar alertas:

1. ✅ Testar todos os tipos de alertas
2. ✅ Treinar equipe em como responder
3. ✅ Monitorar eficácia dos alertas
4. ✅ Ajustar conforme feedback
5. ✅ Criar playbooks de incidentes

---

**Última atualização**: 2026-03-17  
**Versão**: 1.0.0  
**Fase**: Fase 4 - Monitoramento e Alertas