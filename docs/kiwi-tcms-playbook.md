# Playbook de Resposta a Incidentes - Kiwi TCMS

Este playbook fornece procedimentos passo-a-passo para responder a diferentes tipos de alertas do Kiwi TCMS.

## Índice

- [Visão Geral](#visão-geral)
- [Estrutura de Resposta](#estrutura-de-resposta)
- [Playbooks Específicos](#playbooks-específicos)
- [Ferramentas e Comandos](#ferramentas-e-comandos)
- [Comunicação](#comunicação)
- [Melhores Práticas](#melhores-práticas)

---

## Visão Geral

### Objetivo

Responder a alertas de qualidade de testes de forma rápida, eficaz e consistente, minimizando o impacto no desenvolvimento.

### Níveis de Severidade

| Severidade | SLA de Resposta | Impacto | Exemplo |
|-----------|------------------|---------|---------|
| 🔴 CRITICAL | 15 minutos | Alta prioridade, bloqueia deploy | Taxa < 90%, falha em segurança |
| 🟡 WARNING | 2 horas | Prioridade média | Taxa 90-95%, performance ↓20% |
| 🔵 INFO | 24 horas | Baixa prioridade, informativo | Flaky tests, tendências |

### Papéis

- **On-Call Engineer**: Responsável por responder imediatamente a alertas CRITICAL
- **Engineering Team**: Responsável por investigar e corrigir problemas
- **Tech Lead**: Responsável por priorizar e coordenar respostas complexas
- **Product Manager**: Informado sobre impactos no roadmap

---

## Estrutura de Resposta

### 1. Identificação (0-2 minutos)

```
✓ Receber alerta
✓ Classificar severidade (CRITICAL/WARNING/INFO)
✓ Identificar tipo de alerta (qualidade/performance/regressão)
✓ Confirmar se é falso positivo
```

### 2. Triagem (2-5 minutos)

```
✓ Verificar impacto (número de usuários afetados, etc.)
✓ Identificar componente responsável
✓ Verificar se há incidents similares anteriores
✓ Determinar necessidade de escalonamento
```

### 3. Investigação (5-30 minutos)

```
✓ Analisar logs detalhados
✓ Reproduzir o problema localmente
✓ Identificar commit responsável (bisect se necessário)
✓ Verificar dependências recentemente atualizadas
```

### 4. Remediação (Variável)

```
✓ Implementar correção (hotfix se necessário)
✓ Adicionar/remover testes conforme necessário
✓ Atualizar documentação
✓ Corrigir causa raiz (não apenas sintoma)
```

### 5. Validação (5-10 minutos)

```
✓ Executar testes localmente
✓ Executar pipeline completo
✓ Verificar se alerta foi resolvido
✓ Atualizar dashboards
```

### 6. Documentação (5-15 minutos)

```
✓ Atualizar issue com detalhes
✓ Documentar resolução
✓ Criar playbooks adicionais se necessário
✓ Atualizar conhecimento da equipe
```

---

## Playbooks Específicos

### Playbook 1: Taxa de Aprovação Abaixo de 95%

**Trigger**: Alerta CRITICAL ou WARNING sobre taxa de aprovação

**SLA**: 15 minutos (CRITICAL), 2 horas (WARNING)

#### Passo 1: Verificar Alerta (1 min)

```bash
# Verificar detalhes do alerta
curl http://localhost:8080/runs/${BUILD_ID}

# Verificar taxa de aprovação atual
npx ts-node scripts/check-pass-rate.ts
```

#### Passo 2: Identificar Testes Falhados (2 min)

```bash
# Listar testes que falharam
npx ts-node scripts/failed-tests.ts --run-id ${BUILD_ID}

# Exportar para análise
npx ts-node scripts/export-failures.ts --run-id ${BUILD_ID} --output failures.json
```

#### Passo 3: Categorizar Falhas (3 min)

Agrupe falhas em:
- 🔴 **Regressões** (testes que passavam antes)
- 🔄 **Flaky Tests** (alternam sucesso/falha)
- 🔥 **Known Issues** (falhas esperadas/documentadas)
- ❓ **Unknown** (falhas não categorizadas)

#### Passo 4: Priorizar Investigação (2 min)

Ordem de prioridade:
1. Módulos críticos (security, core)
2. Regressões recentes
3. Falhas recorrentes
4. Outras falhas

#### Passo 5: Investigar e Corrigir (variável)

Para cada prioridade:

```bash
# 1. Reproduzir falha localmente
npm test -- --testNamePattern="Teste Que Falhou"

# 2. Analisar logs
cat vitest-results.json | jq '.testResults[] | select(.name == "Teste Que Falhou")'

# 3. Identificar commit responsável
git log --oneline --all --grep="Teste Que Falhou"
git blame src/module/test.ts

# 4. Corrigir problema
# [Implementar correção]

# 5. Adicionar teste se não existir
# [Adicionar teste para prevenir regressão]

# 6. Executar testes localmente
npm test

# 7. Criar PR com hotfix
git checkout -b hotfix/fix-test-failure
git commit -am "fix: correct test failure in X"
git push origin hotfix/fix-test-failure
gh pr create --title "hotfix: fix test failure"
```

#### Passo 6: Validar (5 min)

```bash
# Executar pipeline completo
gh workflow run ci.yml

# Aguardar conclusão e verificar resultado
gh run watch

# Verificar se alerta foi resolvido
curl http://localhost:8080/runs/latest
```

#### Passo 7: Documentar (5 min)

```markdown
## Resolução

**Alerta**: Taxa de aprovação abaixo de 95%
**Data**: 2026-03-17
**Build**: #1234
**Engineer**: @username

### Causa Raiz

[Descrever causa raiz]

### Correção

[Descrever correção implementada]

### Impacto

- [ ] Bloqueou deploy: Sim/Não
- [ ] Usuários afetados: Número
- [ ] Duração: X minutos

### Ações Futuras

- [ ] Melhorar testes para prevenir regressões
- [ ] Adicionar monitoramento adicional
- [ ] Atualizar documentação

### Links

- [ ] Issue relacionada: #XXX
- [ ] PR da correção: #YYY
- [ ] Build da correção: #ZZZ
```

---

### Playbook 2: Nova Regressão Detectada

**Trigger**: Teste que passava agora falha

**SLA**: 15 minutos (CRITICAL)

#### Passo 1: Verificar Regressão (1 min)

```bash
# Verificar histórico do teste
npx ts-node scripts/test-history.ts --test "TesteQueFalhou.ts"

# Confirmar que é uma regressão
# [Deve ter histórico de PASS → FAIL]
```

#### Passo 2: Identificar Commit Responsável (5 min)

```bash
# Usar git bisect para encontrar commit
git bisect start
git bisect bad HEAD    # Commit atual (falha)
git bisect good <last-good-hash>  # Último commit que passou

# O bisect vai iterar até encontrar o commit responsável
# Execute: npm test após cada checkout do bisect

# Quando encontrar o commit:
git bisect reset
```

#### Passo 3: Analisar Mudanças (2 min)

```bash
# Ver diff do commit responsável
git show <commit-hash> --stat

# Ler commit message para contexto
git log --format=fuller <commit-hash> -1

# Verificar issue ou PR relacionada
# [Buscar no GitHub]
```

#### Passo 4: Avaliar Impacto (2 min)

**Perguntas chave**:
- ?? Afeta segurança ou funcionalidade crítica?
- 🔴 Bloqueia deploy para produção?
- 🟡 Afeta muitos usuários?
- 🔵 Baixo impacto, não crítico?

#### Passo 5: Determinar Ação (1 min)

Baseado no impacto:

**Se CRITICAL (segurança/core)**:
```bash
# 1. Reverter mudança imediatamente
git revert <commit-hash>
git push origin master

# 2. Notificar time e stakeholders
# [Enviar alerta no Slack]

# 3. Planejar correção adequada
# [Criar issue com prioridade alta]
```

**Se WARNING (impacto médio)**:
```bash
# 1. Criar issue prioritária
gh issue create --title "Regressão: X" --priority high

# 2. Notificar on-call
# [Mensagem no Slack @oncall]

# 3. Corrigir no próximo sprint
```

**Se INFO (baixo impacto)**:
```bash
# 1. Criar issue para correção
gh issue create --title "Regressão: X" --priority normal

# 2. Adicionar à backlog
```

#### Passo 6: Corrigir e Validar (variável)

```bash
# Implementar correção
# [Implementar código]

# Adicionar teste para prevenir regressão
# [Adicionar teste]

# Executar testes
npm test

# Criar PR
git checkout -b fix/regression-x
git commit -am "fix: resolve regression in X"
git push origin fix/regression-x
gh pr create --title "fix: resolve regression in X"
```

---

### Playbook 3: Degradação de Performance

**Trigger**: Tempo de execução aumentou >20%

**SLA**: 2 horas (WARNING), 4 horas (CRITICAL >50%)

#### Passo 1: Verificar Degradation (2 min)

```bash
# Comparar tempos
npx ts-node scripts/compare-performance.ts \
  --build-id ${BUILD_ID} \
  --compare-with ${PREVIOUS_BUILD_ID}

# Identificar testes mais lentos
npx ts-node scripts/slowest-tests.ts --build-id ${BUILD_ID}
```

#### Passo 2: Categorizar Causas (3 min)

Possíveis causas:
- 🐌 **Testes pesados**: Testes fazendo muito trabalho
- 🔌 **Dependências externas**: Chamadas de API, banco de dados
- 🔁 **Loops/recursão**: Loops infinitos ou profundos
- ?? **Memory leaks**: Alocando memória sem liberar
- ?? **Paralelização**: Falta de paralelização

#### Passo 3: Investigar Testes Lentos (10 min)

Para cada teste lento:

```bash
# 1. Executar teste com profiling
npm test -- --testNamePattern="TesteLento" --profile

# 2. Analisar flamegraph
# [Abrir flamegraph no navegador]

# 3. Identificar bottleneck
# [Analisar código do teste]
```

#### Passo 4: Implementar Otimizações (variável)

**Otimizações comuns**:

1. **Mock de dependências externas**:
```typescript
// Antes (lento)
const result = await fetchExternalAPI();

// Depois (rápido)
vi.mock('../api.ts', () => ({
  fetchExternalAPI: vi.fn().mockResolvedValue(mockData)
}));
```

2. **Caching**:
```typescript
// Adicionar cache
const cache = new Map();
const getResult = async () => {
  if (cache.has(key)) return cache.get(key);
  const result = await expensiveOperation();
  cache.set(key, result);
  return result;
};
```

3. **Paralelização**:
```typescript
// Antes (sequencial)
for (const item of items) {
  await process(item);
}

// Depois (paralelo)
await Promise.all(items.map(item => process(item)));
```

4. **Simplificar setup**:
```typescript
// Reduzir complexidade do setup
beforeEach(() => {
  // Configurar apenas o necessário
  vi.spyOn(someModule, 'function').mockReturnValue(value);
});
```

#### Passo 5: Validar Melhoria (5 min)

```bash
# Executar testes com medição de tempo
npm test -- --profile

# Comparar com baseline
npx ts-node scripts/compare-baseline.ts

# Verificar se meta foi alcançada
# [Tempo deve estar dentro do threshold]
```

#### Passo 6: Documentar (5 min)

```markdown
## Otimização de Performance

**Teste**: TesteLento
**Antes**: 45s
**Depois**: 8s
**Melhoria**: 82% 🚀

### Otimizações

1. Mock de API externa
2. Caching de resultados
3. Simplificação de setup

### Impacto

- [ ] Tempo total de build: -2 minutos
- [ ] Tempo total de pipeline: -1 minuto
```

---

### Playbook 4: Flaky Test Detectado

**Trigger**: Teste alternando entre sucesso e falha

**SLA**: 2 horas (WARNING), 4 horas (CRITICAL)

#### Passo 1: Confirmar Flaky Behavior (2 min)

```bash
# Executar teste múltiplas vezes
for i in {1..10}; do
  npm test -- --testNamePattern="FlakyTest"
done

# Verificar padrão
# [Deve ver alternância entre PASS e FAIL]
```

#### Passo 2: Identificar Causa (10 min)

Causas comuns de flaky tests:

1. **Race Condition**:
```typescript
// ❌ Flaky: depende de ordem assíncrona
await Promise.all([
  operationA(),
  operationB()
]);
// Se B terminar antes de A, pode falhar

// ✅ Fix: usar ordem determinística
await operationA();
await operationB();
```

2. **Falta de Isolamento**:
```typescript
// ❌ Flaky: testes compartilham estado
const globalVariable = {};

// ✅ Fix: isolar estado
beforeEach(() => {
  const localVariable = {};
});
```

3. **Dependência de Recursos Externos**:
```typescript
// ❌ Flaky: depende de rede/recurso externo
const result = await fetch('https://external-api.com');

// ✅ Fix: mockar dependência
vi.mock('node-fetch');
```

4. **Timing Assumptions**:
```typescript
// ❌ Flaky: assume que operação termina em X ms
setTimeout(callback, 100);
expect(mock).toHaveBeenCalled();

// ✅ Fix: usar vi.waitFor
await vi.waitFor(() => {
  expect(mock).toHaveBeenCalled();
});
```

5. **Randomness**:
```typescript
// ❌ Flaky: usa random
const id = Math.random();

// ✅ Fix: usar seed controlado
const id = seededRandom(12345);
```

#### Passo 3: Implementar Fix (variável)

Baseado na causa identificada, implementar a correção apropriada.

#### Passo 4: Adicionar Retries (temporarily) (2 min)

Se não puder corrigir imediatamente:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    retry: 3, // Tentar 3 vezes antes de falhar
    hookTimeout: 10000,
  }
});
```

#### Passo 5: Validar (10 min)

```bash
# Executar teste 10 vezes seguidas
for i in {1..10}; do
  npm test -- --testNamePattern="FlakyTest"
  if [ $? -ne 0 ]; then
    echo "Flaky test ainda existe!"
    exit 1
  fi
done
echo "Teste estável!"
```

---

### Playbook 5: Falha em Módulo Crítico

**Trigger**: Falha em módulo de segurança, core ou crítico

**SLA**: 15 minutos (CRITICAL)

#### Passo 1: Avaliar Severidade (1 min)

**Módulos críticos**:
- 🔴 **Security**: Detectores de segurança, validação de dependências
- 🔴 **Core**: Transformadores, analisadores, pipeline principal
- 🟡 **Important**: Rate limiters, cache, serviços

#### Passo 2: Verificar Impacto (2 min)

```bash
# Verificar quais partes do sistema são afetadas
# [Consultar documentação do módulo]

# Verificar se há usuários/dependentes
# [Verificar downstream]
```

#### Passo 3: Ativar Modo de Emergência (2 min)

Se o problema afeta produção:

```bash
# 1. Reverter última mudança
git revert HEAD
git push origin master

# 2. Ativar feature flag (se disponível)
# [Desativar feature problemática]

# 3. Rollback de deploy (se necessário)
# [Usar Railway/Docker para rollback]
```

#### Passo 4: Notificar Stakeholders (2 min)

**Channels**:
- 🔴 Slack: #escapekit-alerts, @oncall, @tech-lead
- 🔴 Email: security@example.com, team@example.com
- 🔴 GitHub Issue: Create issue with priority CRITICAL

**Mensagem Template**:
```
🚨 CRITICAL ALERT: Falha em Módulo de Segurança

Module: SecurityValidator
Build: #1234
Impact: Alta - afeta validação de dependências

Action: Reversão executada, investigação em progresso

On-Call: @username
Lead: @tech-lead
```

#### Passo 5: Investigar e Corrigir (variável)

```bash
# 1. Analisar logs detalhados
cat vitest-results.json | jq '.testResults[] | select(.name | contains("Security"))'

# 2. Reproduzir localmente
npm test -- --testNamePattern="SecurityValidator"

# 3. Adicionar debug logging
# [Adicionar console.log ou vi.spyOn]

# 4. Corrigir problema
# [Implementar correção]

# 5. Adicionar testes adicionais
# [Prevenir regressão]
```

#### Passo 6: Criar Issue Crítica (2 min)

```bash
gh issue create \
  --title "CRITICAL: Falha em SecurityValidator" \
  --body "## Impacto

Este issue afeta validação de segurança de dependências.

## Causa

[Descrever causa]

## Correção

[Descrever correção]

## Prioridade

🔴 CRITICAL - Bloqueia release

## Timeline

- Falha detectada: 2026-03-17 10:00
- Reversão executada: 2026-03-17 10:05
- Issue criada: 2026-03-17 10:07
- Correção implementada: [Pendente]
- Teste de validação: [Pendente]
- Deploy: [Pendente]

" \
  --label critical,security \
  --assignee @username
```

---

## Ferramentas e Comandos

### Scripts Úteis

```bash
# Verificar taxa de aprovação atual
npx ts-node scripts/check-pass-rate.ts

# Listar testes que falharam
npx ts-node scripts/failed-tests.ts --run-id ${BUILD_ID}

# Verificar histórico de um teste específico
npx ts-node scripts/test-history.ts --test "Teste"

# Comparar performance entre builds
npx ts-node scripts/compare-performance.ts \
  --build-id ${BUILD_ID} \
  --compare-with ${PREVIOUS_BUILD_ID}

# Listar testes mais lentos
npx ts-node scripts/slowest-tests.ts --limit 10

# Exportar falhas para análise
npx ts-node scripts/export-failures.ts \
  --run-id ${BUILD_ID} \
  --output failures.json

# Executar teste com profiling
npm test -- --testNamePattern="Teste" --profile

# Executar testes múltiplas vezes (para flaky tests)
for i in {1..10}; do npm test -- --testNamePattern="Teste"; done
```

### Comandos Git

```bash
# Encontrar commit responsável por regressão
git bisect start
git bisect bad HEAD
git bisect good <last-good-hash>
# [Execute testes após cada checkout]
git bisect reset

# Ver mudanças em um commit
git show <commit-hash> --stat
git show <commit-hash> --patch

# Ver histórico de um arquivo
git log --oneline src/file.ts

# Reverter commit
git revert <commit-hash>

# Ver commits recentes
git log --oneline --graph --decorate -10
```

### Comandos Docker

```bash
# Ver logs do Kiwi TCMS
docker logs kiwi-tcms-escapekit -f

# Ver status dos containers
docker compose -f docker-compose.kiwi.yml ps

# Reiniciar Kiwi TCMS
docker compose -f docker-compose.kiwi.yml restart kiwi-tcms

# Parar tudo
docker compose -f docker-compose.kiwi.yml down
```

### Comandos GitHub CLI

```bash
# Criar issue
gh issue create --title "Title" --body "Body"

# Verificar status do workflow
gh run list

# Assistir workflow em tempo real
gh run watch

# Verificar pull requests
gh pr list

# Criar pull request
gh pr create --title "Title" --body "Body"
```

---

## Comunicação

### Templates de Mensagem

#### Alerta Inicial

```
🚨 ALERT: [Tipo de Alerta]

Build: #1234
Severity: [CRITICAL/WARNING/INFO]
Module: [Nome do módulo]

Impacto: [Descrição do impacto]

On-Call: @username
Lead: @tech-lead

Status: 🔄 Investigando...

📊 Detalhes: http://localhost:8080/runs/1234
```

#### Atualização de Progresso

```
🔄 UPDATE: [Tipo de Alerta]

Build: #1234
Status: Em progresso

Progresso:
- [x] Identificado problema
- [x] Em investigação
- [ ] Correção implementada
- [ ] Teste em andamento

ETA: [Estimado tempo restante]

📊 Detalhes: http://localhost:8080/runs/1234
```

#### Resolução

```
✅ RESOLVED: [Tipo de Alerta]

Build: #1234
Status: Resolvido

Correção:
- PR: #456
- Build: #1235
- Deploy: [Sim/Não]

Time to Resolution: X minutos

Engineering: @username
Review: @reviewer

📊 Detalhes: http://localhost:8080/runs/1235
```

#### Escalonamento

```
🔥 ESCALATE: [Tipo de Alerta]

Build: #1234
Reason: [Motivo do escalonamento]

Escalar para:
- Tech Lead: @tech-lead
- Engineering Manager: @manager
- Product Manager: @pm

Contexto:
[Descrição detalhada do problema]

📊 Detalhes: http://localhost:8080/runs/1234
```

### Channels

| Channel | Uso | Severidade |
|---------|-----|------------|
| #escapekit-alerts | Todos os alertas | Todos |
| #escapekit-critical | Apenas críticos | CRITICAL |
| #escapekit-team | Discussões técnicas | Todos |
| #escapekit-incident | Incidentes ativos | CRITICAL |

### Roles e Responsabilidades

| Role | Responsabilidades |
|------|------------------|
| **On-Call Engineer** | • Responder a alertas CRITICAL dentro de 15 min • Iniciar investigação • Escalonar se necessário |
| **Engineering Team** | • Investigar e corrigir problemas • Participar em incidentes • Documentar resoluções |
| **Tech Lead** | • Priorizar incidentes • Coordenar resposta • Revisar correções críticas |
| **Product Manager** | • Avisado sobre impactos no roadmap • Participar em decisões de rollback |

---

## Melhores Práticas

### 1. Tempo de Resposta

- ?? **CRITICAL**: 15 minutos para primeira resposta, 1 hora para resolução
- 🟡 **WARNING**: 2 horas para resposta, 4 horas para resolução
- 🔵 **INFO**: 24 horas para resposta, 48 horas para resolução

### 2. Documentação

- ✅ Documentar todas as resoluções
- ✅ Atualizar issues com detalhes
- ✅ Criar playbooks para problemas recorrentes
- ✅ Compartilhar aprendizados com a equipe

### 3. Prevenção

- ✅ Adicionar testes para prevenir regressões
- ✅ Melhorar isolamento de testes
- ✅ Mockar dependências externas
- ✅ Adicionar monitoramento proativo

### 4. Comunicação

- ✅ Notificar stakeholders apropriados
- ✅ Atualizar status regularmente
- ✅ Ser transparente sobre impactos
- ✅ Agradecer ajuda recebida

### 5. Aprendizado

- ✅ Realizar post-mortem após incidentes críticos
- ✅ Identificar causas raiz
- ✅ Implementar melhorias de processo
- ✅ Atualizar documentação

---

## Post-Mortem

### Template

```markdown
# Post-Mortem: [Título do Incidente]

**Data**: 2026-03-17
**Duração**: X minutos
**Impacto**: [Descrição do impacto]
**Participantes**: @person1, @person2, @person3

## Resumo Executivo

[Breve descrição do incidente, causa e resolução]

## Timeline

| Hora | Evento |
|-------|--------|
| 10:00 | Alerta recebido |
| 10:05 | Investigação iniciada |
| 10:15 | Problema identificado |
| 10:20 | Correção implementada |
| 10:25 | Teste validado |
| 10:30 | Deploy executado |

## Causa Raiz

[Descrição detalhada da causa raiz usando 5 Whys]

## Ações Imediatas

- [x] Reversão executada
- [x] Correção implementada
- [x] Testes adicionados
- [x] Deploy validado

## Ações Futuras

- [ ] Melhorar testes para prevenir regressões
- [ ] Adicionar monitoramento adicional
- [ ] Atualizar documentação
- [ ] Treinar equipe

## Lições Aprendidas

1. [Lição aprendida]
2. [Lição aprendida]
3. [Lição aprendida]

## Ações de Melhoria

| Ação | Responsável | Prioridade | Deadline |
|-------|-------------|------------|----------|
| [Descrição] | @username | Alta | 2026-03-24 |
| [Descrição] | @username | Média | 2026-03-31 |

## Links

- [ ] Issue original: #XXX
- [ ] PR da correção: #YYY
- [ ] Post-mortem no Wiki: [Link]
```

---

## Recursos Adicionais

- **Kiwi TCMS Docs**: https://kiwitcms.readthedocs.io/
- **Vitest Docs**: https://vitest.dev/
- **GitHub Actions**: https://docs.github.com/en/actions
- **Site Reliability Engineering**: https://sre.google/

---

**Última atualização**: 2026-03-17  
**Versão**: 1.0.0  
**Fase**: Fase 4 - Monitoramento e Alertas