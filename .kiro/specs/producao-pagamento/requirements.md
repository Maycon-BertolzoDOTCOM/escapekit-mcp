# Requisitos — Gateway de Pagamento

## Introdução

Sem cobrança automatizada, o sistema não é um SaaS. Clientes precisam pagar antes de receber uma API key ativa.

## Requisitos

### Requisito 1: Checkout de assinatura mensal

**User Story:** Como cliente, quero pagar minha assinatura online e receber acesso imediato.

#### Critérios de Aceitação

1. WHEN um cliente completa o pagamento, THE sistema SHALL criar automaticamente uma API key ativa para ele
2. THE sistema SHALL suportar planos: Básico (R$197/mês), Popular (R$347/mês), Pro (R$597/mês)
3. WHEN o pagamento falha ou a assinatura é cancelada, THE sistema SHALL desativar a API key do cliente
4. THE sistema SHALL enviar email de confirmação com a API key após pagamento aprovado

### Requisito 2: Webhook de eventos de pagamento

**User Story:** Como operador, quero que o sistema reaja automaticamente a eventos de pagamento.

#### Critérios de Aceitação

1. THE sistema SHALL expor `POST /webhooks/payment` para receber eventos do gateway
2. WHEN recebe evento `payment.approved`, THE sistema SHALL ativar ou criar API key
3. WHEN recebe evento `subscription.canceled`, THE sistema SHALL desativar API key
4. THE webhook SHALL validar assinatura do payload para evitar fraude
