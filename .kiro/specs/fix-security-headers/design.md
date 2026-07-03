# Design Document — fix-security-headers

## Contexto Técnico

O arquivo `pisosrealview-pro-transformed/backend/server.js` usa ES Modules (`import`/`export`) e Express 4.x. O bloco `if (isProd)` atual define apenas um middleware inline com `res.setHeader('X-Content-Type-Options', 'nosniff')`. O pacote `helmet` é o padrão da indústria para Express e define todos os headers necessários com uma única chamada.

## Abordagem

Substituir o middleware inline de headers pelo `helmet` com configuração explícita para o contexto do projeto:

1. Instalar `helmet` como dependência de produção
2. Remover o bloco `if (isProd)` com o middleware manual de `X-Content-Type-Options`
3. Adicionar `app.use(helmet(...))` como middleware global, antes de todos os routers, sem condicional de ambiente (helmet é seguro em dev também e simplifica o código)
4. Configurar `contentSecurityPolicy` para permitir `'self'` e os domínios dos provedores de IA
5. Configurar `crossOriginResourcePolicy` para `cross-origin` (necessário para o frontend Vercel consumir a API)

## Configuração do Helmet

```js
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: [
        "'self'",
        'https://api.wavespeed.ai',
        'https://api.pika.art',
        'https://open.bigmodel.cn', // zhipuai.cn endpoint público
      ],
      imgSrc: ["'self'", 'data:', 'blob:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'no-referrer' },
}));
```

Headers resultantes em todas as respostas:
- `X-Frame-Options: DENY` — padrão do helmet
- `Strict-Transport-Security: max-age=15552000; includeSubDomains` — padrão do helmet
- `X-Content-Type-Options: nosniff` — padrão do helmet
- `X-XSS-Protection: 0` — padrão do helmet (desativa auditor legado)
- `Referrer-Policy: no-referrer` — configurado explicitamente
- `Content-Security-Policy` — configurado explicitamente
- `X-Powered-By` removido — padrão do helmet via `hidePoweredBy`

## Posicionamento no Middleware Stack

O `helmet` deve ser inserido logo após `correlationIdMiddleware` e antes de qualquer router, para garantir que todas as respostas (incluindo erros 4xx/5xx) carreguem os headers de segurança.

```
correlationIdMiddleware  ← já existe, primeiro
helmet(...)              ← novo, segundo
request logging          ← já existe
express.json()           ← já existe
cors()                   ← já existe
routers                  ← já existem
```

## Impacto em Testes Existentes

Os testes em `backend/services/billing/__tests__/` e `backend/services/gateway/__tests__/` testam lógica de negócio e não fazem assertions sobre headers HTTP, portanto não são afetados. Novos testes de integração devem verificar a presença dos headers nas respostas do servidor.

## Arquivo Afetado

- `pisosrealview-pro-transformed/backend/server.js` — única mudança necessária no código existente
- `pisosrealview-pro-transformed/backend/package.json` — adição de `helmet` como dependência
