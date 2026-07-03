# Requisitos — Deploy em Produção

## Introdução

O sistema PisosRealView roda localmente. Para aceitar clientes pagantes, precisa de URL pública, HTTPS e disponibilidade contínua. Este spec cobre o deploy do backend (Railway) e frontend (Vercel).

## Requisitos

### Requisito 1: Backend acessível via URL pública

**User Story:** Como cliente, quero acessar a API de simulação via URL pública, para que eu possa integrar o sistema sem depender da máquina do desenvolvedor.

#### Critérios de Aceitação

1. WHEN o backend é deployado, THE sistema SHALL responder em `https://api.pisosrealview.com.br` ou subdomínio equivalente
2. WHEN uma requisição chega em `POST /v1/simulate`, THE sistema SHALL processar e retornar resposta em menos de 60 segundos
3. THE backend SHALL reiniciar automaticamente em caso de crash (processo gerenciado pela plataforma)
4. THE sistema SHALL carregar variáveis de ambiente da plataforma, sem arquivo `.env` no repositório

### Requisito 2: Frontend acessível via URL pública

**User Story:** Como usuário, quero acessar a interface de simulação via browser sem instalar nada.

#### Critérios de Aceitação

1. WHEN o frontend é deployado, THE sistema SHALL responder em `https://pisosrealview.com.br` ou subdomínio equivalente
2. THE frontend SHALL conectar ao backend via `VITE_API_BASE_URL` configurado na plataforma
3. THE build SHALL completar sem erros (`npm run build`)

### Requisito 3: Variáveis de ambiente seguras

**User Story:** Como operador, quero que as chaves de API não estejam no repositório Git.

#### Critérios de Aceitação

1. THE repositório SHALL conter `.env.example` com nomes das variáveis mas sem valores
2. THE arquivo `.env` SHALL estar no `.gitignore`
3. WHEN o sistema inicia em produção, THE variáveis SHALL ser carregadas da plataforma (Railway/Vercel dashboard)
4. IF uma variável obrigatória estiver ausente, THE sistema SHALL falhar no startup com mensagem clara
