# Arquitetura do Sistema de Visualização Semântica (PisosRealView)

## 1. Propósito do Sistema & Não-Objetivos

O **PisosRealView** é uma infraestrutura de visualização arquitetônica focada na substituição de materiais de piso em contextos de varejo.

**O que o sistema faz:**
*   Realiza a substituição de texturas de piso preservando a geometria, iluminação e oclusão da cena original.
*   Opera como uma ferramenta de suporte à venda técnica, priorizando a verossimilhança física sobre o apelo artístico.

**O que o sistema explicitamente recusa fazer:**
*   Geração criativa ou "hallucination" de elementos não existentes (não inventa móveis, não limpa bagunça).
*   Correção estética da fotografia original (não remove lixo, não ajusta balanço de branco destrutivamente).
*   Preenchimento de áreas ocultas com dados imaginados (Inpainting generativo livre).

**Princípio Fundamental:** É preferível "sub-renderizar" (entregar uma imagem conservadora ou incompleta) do que alucinar dados falsos que quebrem a confiança do cliente final.

## 2. Filosofia Central de Design

O sistema trata a Inteligência Artificial Generativa como **Infraestrutura**, não como uma ferramenta de Criatividade.

### Integridade Semântica
A realidade capturada na foto do cliente é a "Verdade Fundamental" (Ground Truth). O sistema deve operar *apenas* na camada do material do piso. Qualquer alteração em objetos (sapatos, cabos, móveis) ou na estrutura (paredes, rodapés) é considerada uma falha de integridade, não um "efeito colateral".

### Preservação de Objeto > Continuidade Visual
Se houver ambiguidade entre "continuar o piso" ou "preservar um objeto desconhecido", o sistema deve escolher preservar o objeto. Um recorte imperfeito no piso é um erro visual aceitável; um objeto do cliente transformado em piso é uma violação de propriedade.

## 3. Visão Geral da Arquitetura

O pipeline de processamento é linear, síncrono e auditado:

1.  **Aquisição & Otimização:** Entrada da imagem (Client-side compression) e normalização de resolução (max 1536px).
2.  **Análise Semântica (Cérebro 1):** O modelo infere a geometria da sala (L-Shape, Corredor), identifica obstáculos e condições de luz.
3.  **Física do Material (Cérebro 2):** Tradução dos metadados do produto (sku, acabamento) em instruções de renderização física (specularity, roughness).
4.  **Renderização Controlada (Cérebro 3):** Geração da imagem utilizando "Soft Locking" via Prompt Engineering Procedural.
5.  **Auditoria de Fidelidade (The Auditor):** Um agente separado compara a imagem original com a gerada para validar a integridade estrutural.
6.  **Validação de Saída:** Classificação do resultado em níveis de fidelidade (Alta, Moderada, Conservadora) antes da exibição.

## 4. Segmentação Semântica & Estratégia de Locking

O sistema não utiliza máscaras binárias (preto/branco) tradicionais, mas sim **Segmentação Semântica via Prompt**.

### Definição de Classes
*   **Floor Plane (Mutável):** Definido não por cor, mas por perspectiva e vetor de fuga. Inclui extensões geométricas (corredores, cantos).
*   **Non-Floor (Imutável):** Paredes, teto e *todos* os objetos discretos (móveis, detritos, pessoas).

### Estratégia de L-Shape
Para geometrias complexas, o sistema utiliza instruções explícitas de continuidade (`Apply to ENTIRE floor plane, including extensions`). A detecção de cor é secundária à detecção de planos geométricos para evitar que pisos da mesma cor de paredes causem vazamento de textura.

## 5. Restrições de Renderização & Política "Reference-Only"

O renderizador opera sob restrições estritas:

*   **Iluminação:** Deve preservar as sombras originais (`Apply texture UNDERNEATH existing shadows`). A luz não é recriada, é herdada.
*   **Geometria:** Proibido alterar arestas de paredes ou a perspectiva de fuga.
*   **Reflexos:** Em materiais polidos, o sistema deve gerar reflexos *novos* baseados nos objetos existentes, mas não pode mover os objetos.

## 6. Estratégia de Fallback & Contenção de Erro

### Falha de Ativos (Assets)
Se a textura do material falhar no carregamento (404, CORS, Buffer vazio):
1.  O sistema ativa o modo `Fallback`.
2.  Uma textura neutra (`NEUTRAL_GRAY_TEXTURE`) ou sintética é utilizada.
3.  O objetivo muda de "Venda do Produto" para "Visualização de Espaço", mantendo a utilidade da ferramenta sem travar o fluxo.

## 7. Auditoria Semântica & Mecanismo de Undo

Após a renderização, o **Auditor de Fidelidade** analisa o par (Original, Gerada).

### Classificação de Severidade
*   **Nível 3 (Crítico):** Mutação de classe (sapato virou piso), distorção de parede, alucinação grave.
    *   *Ação:* **REJEIÇÃO AUTOMÁTICA**. O sistema descarta a imagem e tenta novamente ou exibe erro.
*   **Nível 2 (Moderado/Médio):** Inconsistências de luz, pequenos vazamentos de textura (<5px), "halo" em objetos complexos.
    *   *Ação:* **APROVAÇÃO COM ALERTA**. Exibe badge "Fidelidade Moderada (Luz Complexa)".
*   **Nível 1 (Baixo/Conservador):** O sistema foi excessivamente cauteloso e preservou áreas que poderiam ser piso.
    *   *Ação:* **APROVAÇÃO**. Exibe badge "Cena Preservada".
*   **Nível 0 (Alta Fidelidade):** Integração perfeita.
    *   *Ação:* **APROVAÇÃO**. Exibe badge "Alta Fidelidade".

## 8. Cache & Estratégia de "Ground Truth"

Para garantir consistência em múltiplas simulações na mesma sessão:

*   **Validated Analysis Cache:** Uma vez que uma análise geométrica (Análise Semântica) produz um resultado visualmente aprovado pelo Auditor, essa análise torna-se a "Verdade Fundamental" (`Ground Truth`).
*   **Reuso:** Simulações subsequentes usam o *mesmo* contexto geométrico cacheado, variando apenas o material. Isso impede que a troca de piso cause "pulos" na estrutura da sala.
*   **Invalidação:** O cache é invalidado se o usuário altera manualmente o ponto de ancoragem (clique no chão) ou reinicia a consulta.

## 9. Concorrência & Controle de Fluxo

*   **Fila por Cliente:** O processamento é atômico por cliente. A UI bloqueia novas solicitações (`state: 'rendering' | 'validating'`) até que o ciclo atual termine.
*   **Prevenção de Race Conditions:** Evita-se que requisições paralelas corrompam o estado visual ou o histórico da consulta.

## 10. Modos de Falha Conhecidos & Riscos Ambientais

Ambientes identificados como de alto risco:
*   **Iluminação Extrema:** Contraluz forte (janelas estouradas) ou escuridão total. O sistema tende a classificar sombras duras como objetos sólidos.
*   **Materiais Ambíguos:** Pisos existentes com cor idêntica às paredes ou móveis sem rodapé definido.
*   **Oclusão Massiva:** Ambientes com >80% de cobertura de chão bloqueada por objetos.

O sistema é projetado para falhar de forma segura ("Fail Open" para avisos, "Fail Closed" para erros críticos), priorizando a não-destruição da imagem original.

## 11. Transparência para o Usuário & Sinais de Confiança

A confiança é construída através da honestidade do sistema sobre suas limitações.

*   **Badges de Fidelidade:** O usuário é informado visualmente (Verde, Amarelo, Azul) sobre o nível de confiança da IA na preservação da realidade.
*   **Sem "Erros":** Evita-se terminologia de falha técnica. Usa-se "Cena Preservada" ou "Fidelidade Moderada" para educar o usuário sobre a complexidade da cena, transferindo a responsabilidade para a física da foto, não para a incompetência do software.

## 12. Modelo de Escalabilidade

Este sistema escala verticalmente em qualidade, não horizontalmente em velocidade massiva.
*   **Limitante:** O tempo de inferência e auditoria (dupla passagem de LLM/Vision).
*   **Garantia:** A repetibilidade e a consistência semântica são as métricas de escala, garantindo que o aumento de volume não degrade a confiança na ferramenta (B2B Trust).

## 13. Extensões Futuras (Non-Breaking)

*   **Reconciliação Multi-View:** Uso de memória semântica para alinhar o piso em múltiplas fotos do mesmo ambiente.
*   **Memória de Sessão:** O sistema aprender com as rejeições manuais do usuário durante a sessão para ajustar a agressividade da renderização.
