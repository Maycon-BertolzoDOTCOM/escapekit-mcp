# Requirements Document

## Introduction

Refatoração do projeto `pisosrealview-pro-transformed` para separar claramente as camadas de backend e frontend. Atualmente, o frontend React importa diretamente módulos Node.js (`Buffer`, `sharp`, `fs`), causando erros no navegador. A refatoração move toda a lógica de IA, gateway, provedores e validação de invariantes para um servidor Express, expondo uma API REST. O frontend passa a ser uma interface pura que consome essa API via `fetch`.

## Glossary

- **Backend**: Servidor Node.js + Express responsável por toda a lógica de processamento de imagem, IA e validação de invariantes.
- **Frontend**: Aplicação React + Vite responsável exclusivamente pela interface do usuário.
- **API**: Interface REST exposta pelo Backend para comunicação com o Frontend.
- **RoomContext**: Objeto que descreve o ambiente detectado na imagem (geometria, iluminação, objetos presentes).
- **Material**: Tipo de piso ou revestimento a ser simulado na imagem.
- **Invariant_Validator**: Módulo do Backend responsável por verificar as invariantes sistêmicas após o processamento de imagem.
- **AI_Gateway**: Módulo do Backend que gerencia chamadas aos provedores de IA (incluindo provedores chineses) com fallback local.
- **Room_Analyzer**: Módulo do Backend que analisa a imagem e extrai o RoomContext.
- **Material_Applier**: Módulo do Backend que aplica o material simulado à imagem.
- **Invariant**: Propriedade sistêmica que deve ser preservada após o processamento — inclui sombras, geometria, objetos e perspectiva.
- **Rate_Limiter**: Módulo do Backend responsável por controlar a taxa de requisições por cliente para proteger os recursos do servidor em produção.

## Requirements

### Requirement 1: Separação de Camadas

**User Story:** Como desenvolvedor, quero que o frontend não importe nenhum módulo Node.js, para que a aplicação funcione corretamente no navegador sem erros de runtime.

#### Acceptance Criteria

1. THE Frontend SHALL importar apenas módulos compatíveis com ambiente de navegador (ESM puro, sem `Buffer`, `sharp`, `fs`, `path` ou qualquer API Node.js).
2. WHEN o Frontend é carregado no navegador, THE Frontend SHALL inicializar sem erros de módulo Node.js.
3. THE Frontend SHALL comunicar-se com o Backend exclusivamente via chamadas `fetch` para a API REST.
4. IF o Frontend tentar importar um módulo Node.js, THEN THE Frontend SHALL falhar na etapa de build com erro explícito de dependência inválida.

---

### Requirement 2: Endpoint de Análise de Ambiente

**User Story:** Como usuário, quero que o sistema analise minha imagem e identifique o ambiente, para que a simulação de materiais seja contextualmente precisa.

#### Acceptance Criteria

1. WHEN o Backend recebe uma requisição `POST /v1/analyze` com `{ imageBase64 }`, THE Backend SHALL invocar o Room_Analyzer e retornar o RoomContext correspondente.
2. WHEN o Room_Analyzer conclui a análise com sucesso, THE Backend SHALL retornar status HTTP 200 com o RoomContext serializado em JSON.
3. IF `imageBase64` estiver ausente ou inválido na requisição, THEN THE Backend SHALL retornar status HTTP 400 com uma mensagem de erro descritiva.
4. IF o Room_Analyzer falhar por indisponibilidade do provedor de IA, THEN THE Backend SHALL acionar o fallback local e retornar um RoomContext estimado com status HTTP 200.

---

### Requirement 3: Endpoint de Simulação de Material

**User Story:** Como usuário, quero simular a aparência de um material de piso na minha imagem, para que eu possa visualizar o resultado antes de comprar.

#### Acceptance Criteria

1. WHEN o Backend recebe uma requisição `POST /v1/simulate` com `{ imageBase64, material }`, THE Backend SHALL invocar o Material_Applier e retornar `{ editedImageBase64, fidelity, context }`.
2. THE Backend SHALL aceitar o campo `material` com o schema `{ type: string, color: string, dimensions: string }`, onde todos os campos são obrigatórios.
3. WHEN o Material_Applier conclui o processamento com sucesso, THE Backend SHALL retornar status HTTP 200 com a imagem editada em base64.
4. IF `imageBase64` ou `material` estiverem ausentes na requisição, THEN THE Backend SHALL retornar status HTTP 400 com uma mensagem de erro descritiva.
5. IF qualquer campo obrigatório do schema de `material` (`type`, `color`, `dimensions`) estiver ausente, THEN THE Backend SHALL retornar status HTTP 400 com uma mensagem indicando o campo faltante.
6. IF o Material_Applier falhar por indisponibilidade do provedor de IA, THEN THE Backend SHALL acionar o fallback local e retornar uma resposta textual descritiva com status HTTP 200.
7. WHEN o Backend retorna a resposta de simulação, THE Backend SHALL incluir o campo `fidelity` indicando o nível de confiança do resultado (valor entre 0.0 e 1.0).

---

### Requirement 4: Validação de Invariantes Sistêmicas

**User Story:** Como sistema, quero garantir que as invariantes de sombra, geometria, objetos e perspectiva sejam preservadas após o processamento, para que a imagem resultante seja fisicamente coerente.

#### Acceptance Criteria

1. WHEN o Material_Applier produz uma imagem editada, THE Invariant_Validator SHALL verificar a preservação de sombras, geometria, objetos e perspectiva antes de o Backend retornar a resposta.
2. WHEN todas as invariantes são satisfeitas, THE Backend SHALL prosseguir com a resposta HTTP 200 normalmente.
3. IF o Invariant_Validator detectar violação de qualquer invariante, THEN THE Backend SHALL registrar em log, em formato JSON, um objeto com os campos `{ timestamp, provider, imageHash, invariantViolated, details }`.
4. IF o Invariant_Validator detectar violação de qualquer invariante, THEN THE Backend SHALL retornar status HTTP 409 com um objeto JSON contendo `{ invariant, description, provider }`.
5. FOR ALL imagens processadas, THE Invariant_Validator SHALL executar todas as quatro verificações (sombras, geometria, objetos, perspectiva) de forma independente antes de emitir o resultado final.

---

### Requirement 5: Interface do Usuário no Frontend

**User Story:** Como usuário, quero uma interface simples para enviar minha imagem e visualizar o resultado da simulação, para que eu possa usar o sistema sem conhecimento técnico.

#### Acceptance Criteria

1. THE Frontend SHALL disponibilizar um componente de upload de imagem que converte o arquivo selecionado para base64 via `FileReader`.
2. THE Frontend SHALL disponibilizar um seletor (dropdown) com as opções de materiais disponíveis.
3. WHEN o usuário clica no botão "Simular", THE Frontend SHALL enviar uma requisição `POST /v1/simulate` com `{ imageBase64, material }` para o Backend.
4. WHEN o Backend retorna status HTTP 200, THE Frontend SHALL exibir a imagem resultante (`editedImageBase64`) na interface.
5. IF o Backend retornar status HTTP 409, THEN THE Frontend SHALL exibir uma mensagem sugerindo ao usuário tentar outro material ou imagem.
6. IF o Backend retornar qualquer outro erro HTTP, THEN THE Frontend SHALL exibir uma mensagem de erro genérica sem expor detalhes internos.
7. THE Frontend SHALL conter apenas lógica de apresentação, sem nenhuma lógica de negócio relacionada a IA, invariantes ou processamento de imagem.

---

### Requirement 6: Configuração de CORS e Comunicação

**User Story:** Como desenvolvedor, quero que o Backend aceite requisições do Frontend em desenvolvimento e produção, para que a comunicação entre as camadas funcione sem bloqueios de segurança.

#### Acceptance Criteria

1. THE Backend SHALL configurar o middleware `cors` para aceitar requisições originadas do Frontend.
2. WHEN o Frontend envia uma requisição para o Backend, THE Backend SHALL responder com os headers CORS apropriados.
3. THE Backend SHALL aceitar requisições com `Content-Type: application/json`.

---

### Requirement 7: Preservação dos Módulos Existentes

**User Story:** Como desenvolvedor, quero que os módulos de IA e invariantes existentes sejam apenas movidos de lugar, para que nenhuma lógica crítica seja perdida ou reescrita desnecessariamente.

#### Acceptance Criteria

1. THE Backend SHALL reutilizar os módulos existentes em `services/ai/` (roomAnalyzer, materialApplier, invariants) sem reescrita de lógica.
2. THE Backend SHALL reutilizar o AI_Gateway existente com todos os provedores configurados.
3. WHEN os módulos são movidos para `backend/services/`, THE Backend SHALL manter os mesmos contratos de interface (assinaturas de função e formatos de retorno).
4. IF qualquer módulo existente depender de variáveis de ambiente, THEN THE Backend SHALL carregar essas variáveis via arquivo `.env` na raiz do diretório `backend/`.

---

### Requirement 8: Requisitos Não Funcionais de Produção

**User Story:** Como operador, quero que o Backend aplique controles de segurança e rate limiting em produção, para que o serviço seja protegido contra abuso e sobrecarga.

#### Acceptance Criteria

1. WHERE o ambiente de execução for produção, THE Rate_Limiter SHALL limitar cada cliente a no máximo 60 requisições por minuto nos endpoints `/v1/analyze` e `/v1/simulate`.
2. IF um cliente exceder o limite de requisições, THEN THE Backend SHALL retornar status HTTP 429 com um objeto JSON contendo `{ error: "Too Many Requests", retryAfter }`.
3. WHERE o ambiente de execução for produção, THE Backend SHALL aplicar o header `X-Content-Type-Options: nosniff` em todas as respostas.
4. WHERE o ambiente de execução for produção, THE Backend SHALL rejeitar requisições cujo payload ultrapasse 10 MB, retornando status HTTP 413.
5. THE Backend SHALL identificar clientes para fins de rate limiting pelo endereço IP de origem da requisição.
