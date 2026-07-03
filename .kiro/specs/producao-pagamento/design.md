# Design — Gateway de Pagamento

## Decisões

**Gateway: Asaas** — mais simples para MEI brasileiro que Stripe. Suporta PIX, boleto e cartão. API REST simples. Webhook nativo.

**Fluxo:**
1. Cliente acessa landing page → clica em "Assinar"
2. Redireciona para link de pagamento Asaas (gerado via API)
3. Cliente paga → Asaas dispara webhook `payment.CONFIRMED`
4. Backend recebe webhook → cria API key → envia email com a key

## Endpoints

```
POST /webhooks/payment
  Body: { event: "PAYMENT_CONFIRMED", payment: { customer: {...}, value, description } }
  → cria API key para o cliente
  → retorna 200

POST /admin/payment/link
  Body: { clientEmail, planId }
  → cria link de pagamento no Asaas
  → retorna { url }
```

## Mapeamento plano → valor

```javascript
const PLAN_PRICES = {
  basic: 197.00,
  popular: 347.00,
  pro: 597.00,
};
```

## Validação do webhook

```javascript
// Asaas envia header 'asaas-access-token' com o token configurado
if (req.headers['asaas-access-token'] !== process.env.ASAAS_WEBHOOK_TOKEN) {
  return res.status(401).json({ error: 'Webhook token inválido' });
}
```

## Variáveis necessárias

```
ASAAS_API_KEY=...
ASAAS_WEBHOOK_TOKEN=...
SENDGRID_API_KEY=... (ou usar nodemailer com Gmail)
```
