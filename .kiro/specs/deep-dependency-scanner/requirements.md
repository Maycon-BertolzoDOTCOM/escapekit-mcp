# Requirements Document: Deep Dependency Scanner

## Introduction

O DeepDependencyScanner estende o PostInstallDetector existente para analisar o grafo completo de dependências transitivas de um projeto Node.js. O ataque postmark-mcp (2025) demonstrou que dependências transitivas — pacotes que são dependências de dependências — podem comprometer servidores MCP sem que o desenvolvedor tenha qualquer visibilidade. O scanner atual analisa apenas dependências diretas listadas em `dependencies`/`devDependencies`, tornando-o cego a esse vetor de ataque.

A solução usa o lockfile (`package-lock.json` ou `yarn.lock`) como fonte de verdade para versões exatas, percorre o grafo de dependências até N níveis de profundidade configurável, e aplica rate limiting para não sobrecarregar o npm registry. O resultado inclui o caminho completo de dependência que levou ao pacote suspeito, permitindo ao desenvolvedor entender exatamente como o risco chegou ao projeto.

## Glossary

- **DeepDependencyScanner**: O componente orquestrador que coordena a análise transitiva de dependências
- **LockFileParser**: Componente responsável por parsear `package-lock.json` e `yarn.lock` em um grafo de dependências
- **DependencyGraph**: Estrutura de dados que representa o grafo completo de dependências com versões exatas e relações pai-filho
- **DependencyNode**: Um nó no grafo representando um pacote com nome, versão exata e lista de dependências filhas
- **TransitiveDependency**: Dependência que não está listada diretamente no `package.json` do projeto, mas é requerida por uma dependência direta ou por outra dependência transitiva
- **ScanDepth**: O nível de profundidade no grafo de dependências (0 = projeto raiz, 1 = dependências diretas, 2 = dependências de dependências, etc.)
- **DependencyPath**: A cadeia de pacotes desde a dependência direta até o pacote suspeito (ex: `projeto → pacote-a → pacote-b → pacote-malicioso`)
- **RateLimiter**: Componente que controla o número de requisições simultâneas e por minuto ao npm registry
- **ScanMode**: Modo de operação do scanner — `shallow` (apenas dependências diretas, comportamento atual) ou `deep` (grafo completo)
- **PostInstallDetector**: Componente existente que analisa scripts postinstall de dependências diretas
- **NPMRegistry**: Serviço existente que consulta o npm registry com retry e cache
- **PatternMatcher**: Componente existente que detecta padrões suspeitos em scripts
- **RiskScorer**: Componente existente que calcula score de risco 0-100
- **IssueGenerator**: Componente existente que gera issues estruturados com sugestões de remediação
- **MAX_DEPTH**: Profundidade máxima de análise do grafo de dependências (padrão: 3)
- **Transitive_Issue**: Um Issue gerado para um pacote transitivo, contendo o DependencyPath e o ScanDepth onde foi encontrado

## Requirements

### Requirement 1: Parsear package-lock.json

**User Story:** Como desenvolvedor, quero que o scanner leia o `package-lock.json` para obter versões exatas de todas as dependências, para que a análise seja precisa e reproduzível.

#### Acceptance Criteria

1. WHEN um arquivo `package-lock.json` válido é fornecido, THE LockFileParser SHALL extrair todos os pacotes com seus nomes e versões exatas
2. WHEN um `package-lock.json` no formato lockfileVersion 2 ou 3 é fornecido, THE LockFileParser SHALL construir um DependencyGraph com as relações pai-filho corretas
3. WHEN um `package-lock.json` no formato lockfileVersion 1 é fornecido, THE LockFileParser SHALL construir um DependencyGraph a partir do campo `dependencies` aninhado
4. WHEN um arquivo `package-lock.json` contém JSON inválido, THE LockFileParser SHALL retornar um erro descritivo sem lançar exceção não tratada
5. WHEN um arquivo `package-lock.json` não é encontrado no caminho fornecido, THE LockFileParser SHALL retornar um erro indicando que o lockfile está ausente
6. THE LockFileParser SHALL preservar a versão exata (não o range semver) de cada pacote no DependencyGraph
7. FOR ALL DependencyGraph válidos, parsear então serializar então parsear SHALL produzir um grafo equivalente (propriedade round-trip)

### Requirement 2: Parsear yarn.lock

**User Story:** Como desenvolvedor que usa Yarn, quero que o scanner leia o `yarn.lock` para obter o grafo de dependências, para que projetos Yarn também sejam protegidos.

#### Acceptance Criteria

1. WHEN um arquivo `yarn.lock` válido (formato Yarn v1) é fornecido, THE LockFileParser SHALL extrair todos os pacotes com versões exatas resolvidas
2. WHEN um arquivo `yarn.lock` válido (formato Yarn Berry/v2+) é fornecido, THE LockFileParser SHALL extrair todos os pacotes com versões exatas resolvidas
3. WHEN um arquivo `yarn.lock` contém sintaxe inválida, THE LockFileParser SHALL retornar um erro descritivo
4. WHEN nenhum lockfile é encontrado (nem `package-lock.json` nem `yarn.lock`), THE DeepDependencyScanner SHALL emitir um aviso e operar em modo shallow usando apenas o `package.json`
5. WHEN ambos `package-lock.json` e `yarn.lock` existem, THE DeepDependencyScanner SHALL priorizar o `package-lock.json`

### Requirement 3: Construir o Grafo de Dependências

**User Story:** Como desenvolvedor, quero que o scanner construa o grafo completo de dependências, para que eu possa entender as relações entre pacotes.

#### Acceptance Criteria

1. THE DependencyGraph SHALL representar cada pacote como um DependencyNode com nome, versão exata e lista de dependências filhas
2. THE DeepDependencyScanner SHALL identificar os DependencyNodes de nível 1 (ScanDepth=1) como os pacotes listados em `dependencies` e `devDependencies` do `package.json` do projeto
3. WHEN um pacote aparece múltiplas vezes no grafo com a mesma versão, THE DeepDependencyScanner SHALL deduplica-lo para evitar análise redundante
4. THE DependencyGraph SHALL suportar detecção de ciclos para evitar loops infinitos durante a travessia
5. WHEN um ciclo é detectado durante a construção do grafo, THE DeepDependencyScanner SHALL registrar o ciclo e interromper a travessia naquele ramo

### Requirement 4: Análise Transitiva com Controle de Profundidade

**User Story:** Como desenvolvedor, quero controlar a profundidade da análise transitiva, para que eu possa balancear cobertura de segurança com tempo de execução.

#### Acceptance Criteria

1. THE DeepDependencyScanner SHALL aceitar um parâmetro `maxDepth` com valor padrão de 3
2. WHEN `maxDepth` é definido como N, THE DeepDependencyScanner SHALL analisar pacotes até ScanDepth=N inclusive
3. WHEN `maxDepth` é definido como 1, THE DeepDependencyScanner SHALL analisar apenas dependências diretas (equivalente ao modo shallow)
4. WHEN `maxDepth` é definido como 0, THE DeepDependencyScanner SHALL retornar um resultado vazio sem analisar nenhuma dependência
5. WHEN um pacote suspeito é encontrado em ScanDepth=N, THE DeepDependencyScanner SHALL incluir o ScanDepth no Transitive_Issue gerado
6. THE DeepDependencyScanner SHALL incluir o DependencyPath completo em cada Transitive_Issue (ex: `root → express → qs → pacote-malicioso`)

### Requirement 5: Rate Limiting para o NPM Registry

**User Story:** Como desenvolvedor, quero que o scanner respeite limites de taxa do npm registry, para que a análise não seja bloqueada por rate limiting externo.

#### Acceptance Criteria

1. THE RateLimiter SHALL limitar o número de requisições simultâneas ao npm registry a no máximo 20
2. THE RateLimiter SHALL limitar o número de requisições por minuto ao npm registry a no máximo 80
3. WHEN o limite de 20 requisições simultâneas é atingido, THE RateLimiter SHALL enfileirar as requisições excedentes e processá-las conforme slots ficam disponíveis
4. WHEN o limite de 80 requisições por minuto é atingido, THE RateLimiter SHALL aguardar o início do próximo intervalo de 60 segundos antes de enviar novas requisições
5. THE RateLimiter SHALL ser configurável via parâmetros `maxConcurrent` e `maxPerMinute`
6. WHILE o RateLimiter está aguardando, THE DeepDependencyScanner SHALL continuar processando pacotes já em cache sem bloquear

### Requirement 6: Cache de Resultados por Versão Exata

**User Story:** Como desenvolvedor, quero que o scanner evite consultar o mesmo pacote duas vezes, para que a análise seja eficiente mesmo em grafos grandes.

#### Acceptance Criteria

1. THE DeepDependencyScanner SHALL usar o par `(nome, versão)` como chave de cache para resultados de análise
2. WHEN um pacote com a mesma versão exata já foi analisado, THE DeepDependencyScanner SHALL reutilizar o resultado em cache sem nova consulta ao npm registry
3. THE DeepDependencyScanner SHALL reutilizar o cache existente do NPMRegistry para consultas de existência de pacotes
4. WHEN o cache é compartilhado entre múltiplas execuções do scanner na mesma sessão, THE DeepDependencyScanner SHALL retornar resultados consistentes
5. THE DeepDependencyScanner SHALL reportar estatísticas de cache (hits, misses) nos metadados do resultado de análise

### Requirement 7: Modo Shallow e Modo Deep

**User Story:** Como desenvolvedor, quero escolher entre análise rápida (shallow) e análise completa (deep), para que eu possa usar o modo adequado para cada situação.

#### Acceptance Criteria

1. THE DeepDependencyScanner SHALL aceitar um parâmetro `mode` com valores `shallow` ou `deep`
2. WHEN `mode` é `shallow`, THE DeepDependencyScanner SHALL analisar apenas dependências diretas do `package.json` (comportamento equivalente ao PostInstallDetector atual)
3. WHEN `mode` é `deep`, THE DeepDependencyScanner SHALL analisar o grafo completo de dependências até `maxDepth`
4. WHEN `mode` não é especificado, THE DeepDependencyScanner SHALL usar `shallow` como padrão para manter compatibilidade retroativa
5. WHEN `mode` é `shallow`, THE DeepDependencyScanner SHALL completar a análise sem requerer a presença de um lockfile

### Requirement 8: Flag --deep-scan na CLI

**User Story:** Como desenvolvedor, quero usar `--deep-scan` na CLI para ativar a análise transitiva, para que eu possa verificar meu projeto com um único comando.

#### Acceptance Criteria

1. THE CLI SHALL aceitar a flag `--deep-scan` no comando `analyze`
2. WHEN `--deep-scan` é fornecido, THE CLI SHALL invocar o DeepDependencyScanner em modo `deep`
3. WHEN `--deep-scan` é fornecido sem um lockfile presente, THE CLI SHALL exibir um aviso indicando que o lockfile está ausente e continuar em modo shallow
4. THE CLI SHALL aceitar a opção `--max-depth <n>` para configurar a profundidade máxima (padrão: 3)
5. WHEN `--deep-scan` é fornecido, THE CLI SHALL exibir o número total de dependências transitivas analisadas no resumo de saída
6. WHEN um pacote suspeito é encontrado em modo deep, THE CLI SHALL exibir o DependencyPath completo na saída de issues

### Requirement 9: Reportar Profundidade e Caminho de Dependência

**User Story:** Como desenvolvedor, quero saber exatamente onde no grafo de dependências um pacote suspeito foi encontrado, para que eu possa tomar a ação correta (atualizar a dependência direta que o puxa).

#### Acceptance Criteria

1. WHEN um Transitive_Issue é gerado, THE DeepDependencyScanner SHALL incluir o ScanDepth no campo `description` do issue
2. WHEN um Transitive_Issue é gerado, THE DeepDependencyScanner SHALL incluir o DependencyPath completo no campo `description` do issue
3. WHEN um Transitive_Issue é gerado, THE DeepDependencyScanner SHALL identificar a dependência direta (ScanDepth=1) responsável por puxar o pacote suspeito
4. THE IssueGenerator SHALL gerar sugestões de remediação que referenciam a dependência direta a ser atualizada ou substituída
5. WHEN o mesmo pacote suspeito é alcançado por múltiplos caminhos, THE DeepDependencyScanner SHALL gerar um único Transitive_Issue com todos os DependencyPaths listados

### Requirement 10: Teste de Regressão — Ataque postmark-mcp

**User Story:** Como mantenedor do EscapeKit, quero um teste de regressão que detecte o ataque postmark-mcp via dependência transitiva, para que eu tenha garantia de que o scanner cobre esse vetor de ataque real.

#### Acceptance Criteria

1. THE DeepDependencyScanner SHALL detectar um script postinstall malicioso em uma dependência transitiva que simula o padrão do ataque postmark-mcp (curl + base64 + env vars)
2. WHEN o pacote malicioso está em ScanDepth=2 (dependência de uma dependência direta), THE DeepDependencyScanner SHALL gerar um Transitive_Issue com severity `error`
3. WHEN o pacote malicioso está em ScanDepth=3, THE DeepDependencyScanner SHALL gerar um Transitive_Issue com severity `error`
4. THE Transitive_Issue gerado para o padrão postmark-mcp SHALL incluir o DependencyPath completo mostrando como o pacote malicioso foi alcançado
5. WHEN `mode` é `shallow`, THE DeepDependencyScanner SHALL NÃO detectar o pacote malicioso em ScanDepth >= 2 (validando que o modo shallow é cego a esse ataque)

### Requirement 11: Performance — 200 Dependências em 30 Segundos

**User Story:** Como desenvolvedor, quero que a análise de 200 dependências transitivas complete em menos de 30 segundos, para que o scanner seja viável em projetos reais.

#### Acceptance Criteria

1. THE DeepDependencyScanner SHALL analisar 200 dependências transitivas distintas em menos de 30 segundos em condições normais de rede
2. THE DeepDependencyScanner SHALL processar requisições ao npm registry em paralelo respeitando os limites do RateLimiter
3. WHEN o cache está aquecido (warm cache), THE DeepDependencyScanner SHALL analisar 200 dependências em menos de 5 segundos
4. THE DeepDependencyScanner SHALL reportar o tempo total de análise nos metadados do resultado
5. WHEN `maxDepth` é aumentado de 3 para 5, THE DeepDependencyScanner SHALL completar a análise em menos de 60 segundos para projetos com até 500 nós no grafo

### Requirement 12: Integração com PostInstallDetector Existente

**User Story:** Como desenvolvedor, quero que o DeepDependencyScanner reutilize a infraestrutura existente de detecção de padrões, para que a análise transitiva seja consistente com a análise direta.

#### Acceptance Criteria

1. THE DeepDependencyScanner SHALL reutilizar o PatternMatcher existente para detectar padrões suspeitos em scripts de dependências transitivas
2. THE DeepDependencyScanner SHALL reutilizar o RiskScorer existente para calcular scores de risco de dependências transitivas
3. THE DeepDependencyScanner SHALL reutilizar o IssueGenerator existente para criar Transitive_Issues
4. THE DeepDependencyScanner SHALL reutilizar o NPMRegistry existente (com o RateLimiter adicional) para consultar metadados de pacotes transitivos
5. WHEN `mode` é `shallow`, THE DeepDependencyScanner SHALL delegar a análise ao PostInstallDetector existente sem modificar seu comportamento
6. THE PostInstallDetector existente SHALL manter compatibilidade retroativa total — nenhuma interface pública existente SHALL ser alterada

### Requirement 13: Tratamento de Erros e Degradação Graciosa

**User Story:** Como desenvolvedor, quero que falhas em pacotes individuais não interrompam a análise completa, para que eu receba resultados parciais mesmo quando alguns pacotes não estão acessíveis.

#### Acceptance Criteria

1. WHEN a consulta ao npm registry falha para um pacote transitivo específico, THE DeepDependencyScanner SHALL registrar o erro, marcar o pacote como `unverified` e continuar analisando os demais
2. WHEN o lockfile está corrompido ou ilegível, THE DeepDependencyScanner SHALL retornar um erro descritivo e não gerar issues parciais
3. IF um timeout ocorre durante a análise de um pacote transitivo, THEN THE DeepDependencyScanner SHALL marcar o pacote como `unverified` com severity `warning`
4. THE DeepDependencyScanner SHALL incluir no resultado final a contagem de pacotes analisados com sucesso, pacotes com erro e pacotes não verificados
5. WHEN mais de 50% dos pacotes retornam erro de rede, THE DeepDependencyScanner SHALL emitir um aviso de conectividade e sugerir retry

## Success Metrics

A implementação será considerada bem-sucedida quando:

- O teste de regressão do ataque postmark-mcp detectar o pacote malicioso em ScanDepth=2 com severity `error`
- A análise de 200 dependências transitivas completar em menos de 30 segundos
- Zero falsos positivos em pacotes populares (react, express, lodash, axios) em modo deep
- O modo shallow mantiver compatibilidade retroativa total com o PostInstallDetector existente
- O DependencyPath completo for exibido em todos os Transitive_Issues gerados
