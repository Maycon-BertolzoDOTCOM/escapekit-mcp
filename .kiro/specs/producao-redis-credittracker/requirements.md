# Requisitos — CreditTracker com Redis

## Introdução

O `CreditTracker` atual persiste contadores em `credits.json`. Em deploy com múltiplos processos (workers), dois processos podem ler o mesmo valor e sobrescrever um ao outro — race condition. Redis resolve isso com operações atômicas (`INCR`).

## Requisitos

### Requisito 1: Contadores atômicos em Redis

**User Story:** Como operador, quero que o controle de créditos funcione corretamente com múltiplos workers, para que o sistema escale sem perder contagens.

#### Critérios de Aceitação

1. WHEN dois processos incrementam o mesmo contador simultaneamente, THE sistema SHALL garantir que o valor final seja a soma correta (sem perda)
2. THE operação de incremento SHALL ser atômica (usar `INCR` do Redis)
3. WHEN o Redis está indisponível, THE sistema SHALL usar fallback em memória e logar o erro
4. THE comportamento externo do `CreditTracker` SHALL ser idêntico ao atual (mesma interface pública)

### Requisito 2: Rollover mensal automático

**User Story:** Como operador, quero que os contadores resetem automaticamente no início de cada mês.

#### Critérios de Aceitação

1. THE chave Redis SHALL incluir o mês: `credits:{providerId}:{YYYY-MM}`
2. WHEN um novo mês começa, THE sistema SHALL usar uma nova chave automaticamente (a antiga expira)
3. THE TTL das chaves Redis SHALL ser de 35 dias (garante que a chave do mês anterior ainda existe para auditoria)

### Requisito 3: Compatibilidade com testes existentes

**User Story:** Como desenvolvedor, quero que os 13 testes do CreditTracker continuem passando.

#### Critérios de Aceitação

1. THE interface pública do `CreditTracker` SHALL manter os mesmos métodos: `isExhausted`, `increment`, `getState`, `reset`
2. THE construtor SHALL aceitar um cliente Redis mockável para testes
3. WHEN o cliente Redis é um mock, THE comportamento SHALL ser idêntico ao atual
