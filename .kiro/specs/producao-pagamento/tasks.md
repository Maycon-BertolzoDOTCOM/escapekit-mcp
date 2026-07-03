# Tarefas — Gateway de Pagamento

## Tarefas

- [ ] 1. Criar conta Asaas e configurar webhook
  - Criar conta em asaas.com (MEI)
  - Obter `ASAAS_API_KEY` (sandbox primeiro)
  - Configurar URL do webhook: `https://api.pisosrealview.com.br/webhooks/payment`
  - Obter `ASAAS_WEBHOOK_TOKEN`
  - _Requisitos: 2.1, 2.4_

- [ ] 2. Implementar `POST /webhooks/payment`
  - Validar `asaas-access-token` no header
  - Processar evento `PAYMENT_CONFIRMED`: criar API key e salvar em `api-keys.json`
  - Processar evento `SUBSCRIPTION_CANCELED`: desativar API key
  - _Requisitos: 2.1, 2.2, 2.3, 2.4_

- [ ] 3. Implementar envio de email com API key
  - Usar `nodemailer` com Gmail ou SendGrid
  - Template: "Sua API key: sk_live_xxx — inclua no header X-API-Key"
  - _Requisitos: 1.4_

- [ ] 4. Implementar `POST /admin/payment/link`
  - Chamar API Asaas para criar link de pagamento
  - Retornar URL para o operador enviar ao cliente
  - _Requisitos: 1.1_

- [ ] 5. Testar fluxo completo em sandbox
  - Criar link de pagamento → pagar em sandbox → verificar webhook → verificar API key criada
  - _Requisitos: 1.1, 1.2, 2.2_
