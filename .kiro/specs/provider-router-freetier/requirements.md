# Documento de Requisitos

## Introdução

O `ProviderRouter` é uma evolução do gateway de IA existente no sistema `pisosrealview-pro-transformed`. O gateway atual executa uma cascata estática WaveSpeedAI → Zhipu CogView → fallback local. Esta feature substitui essa lógica por um roteador dinâmico orientado a custo, que prioriza provedores gratuitos antes de provedores pagos, rastreia o consumo de créditos mensais por provedor e seleciona automaticamente o provedor mais barato disponível no momento de cada requisição.

O objetivo estratégico é manter custo operacional zero enquanto os tiers gratuitos (Pika Labs e Zhipu CogVideoX-Flash) não se esgotarem, e garantir continuidade de serviço mesmo quando todos os provedores externos falharem, via fallback local textual.

## Glossário

- **ProviderRouter**: Componente central desta feature. Substitui o gateway atual e é responsável por ordenar, selecionar e acionar provedores de IA.
- **Provider**: Serviço externo ou local capaz de processar uma requisição de simulação de piso. Cada provedor tem custo, tier e limite de créditos.
- **CreditTracker**: Componente responsável por rastrear o consumo de créditos mensais de cada provedor e persistir esse estado.
- **FreeTier**: Quantidade de créditos gratuitos disponíveis por mês em um provedor. Quando esgotado, o provedor é considerado pago.
- **Cascata**: Sequência ordenada de provedores tentados em ordem crescente de custo até que um retorne sucesso.
- **Fallback Local**: Provedor de custo zero sempre disponível que retorna uma descrição textual da simulação quando todos os provedores externos falham.
- **Pika Labs**: Provedor externo com 80 créditos gratuitos por mês, geração de imagem em 480p.
- **Zhipu CogVideoX-Flash**: Provedor externo gratuito (sem limite de créditos documentado), modelo `cogview-3-flash`.
- **WaveSpeedAI**: Provedor externo com créditos iniciais de cadastro, depois pago (~$0.01/req), modelo `qwen-image-edit`.
- **CometAPI**: Provedor externo agregador de 500+ modelos, 20-40% mais barato que acesso direto.
- **Endpoint Admin**: Rota HTTP protegida para operações administrativas como reset de contadores.
- **Requisição de Simulação**: Chamada ao `ProviderRouter` contendo `imageBase64`, `material` e `context` para gerar uma imagem de piso simulado.

## Requisitos

### Requisito 1: Ordenação de Provedores por Custo

**User Story:** Como operador do sistema, quero que os provedores sejam tentados em ordem crescente de custo, para que o custo operacional seja minimizado automaticamente.

#### Critérios de Aceitação

1. THE `ProviderRouter` SHALL manter uma lista ordenada de provedores na sequência: Pika Labs → Zhipu CogVideoX-Flash → WaveSpeedAI → CometAPI → Fallback Local.
2. WHEN uma `Requisição de Simulação` é recebida, THE `ProviderRouter` SHALL tentar os provedores na ordem definida, do menor para o maior custo.
3. WHEN um provedor retorna sucesso, THE `ProviderRouter` SHALL retornar o resultado imediatamente sem tentar os provedores seguintes.
4. THE `ProviderRouter` SHALL incluir o identificador do provedor utilizado no objeto de resposta de cada `Requisição de Simulação`.

---

### Requisito 2: Rastreamento de Créditos por Provedor

**User Story:** Como operador do sistema, quero que o consumo de créditos de cada provedor seja rastreado mensalmente, para que o sistema saiba quando um tier gratuito foi esgotado.

#### Critérios de Aceitação

1. THE `CreditTracker` SHALL manter um contador de créditos consumidos no mês corrente para cada provedor que possui `FreeTier`.
2. WHEN uma `Requisição de Simulação` é concluída com sucesso por um provedor com `FreeTier`, THE `CreditTracker` SHALL incrementar o contador desse provedor em 1 crédito.
3. WHEN o contador de créditos de um provedor atinge o limite configurado do `FreeTier`, THE `ProviderRouter` SHALL pular esse provedor nas requisições subsequentes do mesmo mês.
4. THE `CreditTracker` SHALL persistir os contadores de crédito em arquivo JSON no sistema de arquivos local para sobreviver a reinicializações do processo.
5. WHEN o mês calendário muda, THE `CreditTracker` SHALL resetar automaticamente todos os contadores de crédito para zero.

---

### Requisito 3: Configuração via Variáveis de Ambiente

**User Story:** Como desenvolvedor, quero configurar os limites de crédito e chaves de API via variáveis de ambiente, para que o sistema seja portável entre ambientes sem alteração de código.

#### Critérios de Aceitação

1. THE `ProviderRouter` SHALL ler as chaves de API de cada provedor exclusivamente de variáveis de ambiente (`PIKA_API_KEY`, `ZHIPU_API_KEY`, `WAVESPEED_API_KEY`, `COMET_API_KEY`).
2. THE `ProviderRouter` SHALL ler os limites de `FreeTier` de variáveis de ambiente (`PIKA_FREE_CREDITS_LIMIT`, `ZHIPU_FREE_CREDITS_LIMIT`) com valores padrão de 80 e 0 respectivamente.
3. IF uma variável de ambiente de chave de API de um provedor não estiver definida, THEN THE `ProviderRouter` SHALL pular esse provedor sem lançar exceção.
4. THE `ProviderRouter` SHALL ler o timeout de requisição da variável de ambiente `PROVIDER_TIMEOUT_MS` com valor padrão de 45000 milissegundos.

---

### Requisito 4: Tolerância a Falhas e Timeout

**User Story:** Como usuário do sistema, quero que a simulação continue funcionando mesmo quando provedores externos falham ou demoram demais, para que eu sempre receba uma resposta.

#### Critérios de Aceitação

1. WHEN um provedor externo não responde dentro do tempo configurado em `PROVIDER_TIMEOUT_MS`, THE `ProviderRouter` SHALL cancelar a requisição a esse provedor e tentar o próximo na cascata.
2. WHEN um provedor externo retorna um código HTTP de erro (4xx ou 5xx), THE `ProviderRouter` SHALL registrar o erro e tentar o próximo provedor na cascata.
3. WHEN todos os provedores externos falham ou são pulados, THE `ProviderRouter` SHALL retornar a resposta do Fallback Local com `fallback: true`.
4. THE `Fallback Local` SHALL estar sempre disponível e SHALL retornar uma descrição textual da simulação sem depender de serviços externos.
5. IF o `Fallback Local` for o único provedor disponível, THEN THE `ProviderRouter` SHALL retornar `success: false` com `fallback: true` e uma `fallbackDescription` descritiva.

---

### Requisito 5: Logs Estruturados por Requisição

**User Story:** Como operador do sistema, quero logs estruturados indicando qual provedor foi usado e quantos créditos restam, para que eu possa monitorar o consumo e diagnosticar falhas.

#### Critérios de Aceitação

1. WHEN uma `Requisição de Simulação` é concluída com sucesso, THE `ProviderRouter` SHALL emitir um log estruturado contendo: identificador do provedor, créditos consumidos no mês e créditos restantes do `FreeTier` (quando aplicável).
2. WHEN um provedor falha durante uma `Requisição de Simulação`, THE `ProviderRouter` SHALL emitir um log de aviso contendo: identificador do provedor, motivo da falha e o próximo provedor a ser tentado.
3. WHEN um provedor é pulado por ter esgotado o `FreeTier`, THE `ProviderRouter` SHALL emitir um log informativo indicando o provedor pulado e o motivo.
4. THE `ProviderRouter` SHALL emitir todos os logs no formato JSON com os campos `timestamp`, `level`, `provider`, `event` e `details`.

---

### Requisito 6: Transparência para o Frontend

**User Story:** Como desenvolvedor frontend, quero que a interface não precise conhecer qual provedor foi utilizado, para que a lógica de roteamento seja completamente encapsulada no backend.

#### Critérios de Aceitação

1. THE `ProviderRouter` SHALL expor a mesma assinatura de função do gateway atual: `requestSimulation(imageBase64, material, context)`.
2. THE `ProviderRouter` SHALL retornar um objeto de resposta com os campos `success`, `editedImageBase64`, `fidelity`, `provider`, `fallback` e `fallbackDescription` (quando aplicável), mantendo compatibilidade com o contrato atual.
3. THE `materialApplier` SHALL continuar chamando `requestSimulation` sem alteração na sua interface, após a substituição do gateway pelo `ProviderRouter`.

---

### Requisito 7: Endpoint Admin para Reset de Contadores

**User Story:** Como operador do sistema, quero um endpoint administrativo para resetar os contadores de crédito manualmente, para que eu possa corrigir contagens incorretas ou simular início de novo mês em ambiente de desenvolvimento.

#### Critérios de Aceitação

1. THE `ProviderRouter` SHALL expor uma função `resetCredits(providerId?)` que reseta o contador de um provedor específico ou de todos os provedores quando `providerId` não é fornecido.
2. WHEN o endpoint `POST /admin/credits/reset` é chamado com um `providerId` válido no corpo da requisição, THE `ProviderRouter` SHALL resetar o contador desse provedor e retornar o estado atualizado dos contadores.
3. WHEN o endpoint `POST /admin/credits/reset` é chamado sem `providerId`, THE `ProviderRouter` SHALL resetar os contadores de todos os provedores e retornar o estado atualizado.
4. IF o endpoint `POST /admin/credits/reset` for chamado sem autenticação válida, THEN THE `ProviderRouter` SHALL retornar HTTP 401.

---

### Requisito 8: Extensibilidade para Novos Provedores

**User Story:** Como desenvolvedor, quero adicionar novos provedores ao roteador sem alterar a lógica central de roteamento, para que o sistema seja facilmente extensível.

#### Critérios de Aceitação

1. THE `ProviderRouter` SHALL aceitar uma lista de provedores configurável na inicialização, onde cada provedor é definido por: `id`, `costTier` (número inteiro representando custo relativo), `freeCreditLimit` (0 para provedores sem tier gratuito) e uma função `call(imageBase64, material, context)`.
2. WHEN um novo provedor é adicionado à lista de configuração, THE `ProviderRouter` SHALL incluí-lo automaticamente na cascata na posição correta de acordo com seu `costTier`, sem alteração no código de roteamento.
3. THE `ProviderRouter` SHALL ordenar os provedores por `costTier` crescente em tempo de inicialização, garantindo que provedores com menor custo sejam sempre tentados primeiro.
