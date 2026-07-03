# Requirements Document

## Introduction

Este documento descreve os requisitos para um mapa de riscos e pontos de atenção da manutenção do repositório EscapeKit MCP (RalphLoopInverso). O objetivo é identificar, classificar e tornar rastreáveis os principais riscos estruturais, técnicos e operacionais do projeto, de forma que qualquer mantenedor consiga compreender o estado real do repositório e tomar decisões informadas sobre priorização e intervenções.

O EscapeKit MCP é um produto TypeScript/Node.js cujo propósito central é analisar código gerado em sandboxes de IA, detectar dependências "fantasma", transformar esse código e validar sua execução em ambiente real. A maturidade desigual dos componentes, a presença de subprojetos misturados à raiz e o acúmulo de artefatos não versionados tornam a manutenção de alto custo cognitivo.

## Glossary

- **Risk_Map**: Documento ou artefato estruturado que lista e classifica os riscos identificados no repositório.
- **Mantenedor**: Desenvolvedor responsável por evoluir ou corrigir o projeto EscapeKit MCP.
- **Repositório**: O diretório raiz do projeto RalphLoopInverso, incluindo todos os subprojetos e artefatos.
- **Subprojeto**: Diretório dentro do repositório que contém um projeto independente (ex: `qwen-escapekit/`, `pisosrealview-pro-transformed/`).
- **Artefato_Gerado**: Arquivo produzido por builds, transformações ou execuções que não deve ser versionado (ex: `dist/`, `node_modules/`, logs).
- **Estado_Sujo**: Condição do repositório em que há alterações locais não commitadas no controle de versão (git).
- **Componente_Placeholder**: Módulo ou função cujo comportamento está mockado ou incompleto, sem implementação real (ex: `validate_reality`).
- **Custo_Cognitivo**: Esforço mental necessário para um novo mantenedor compreender o estado e a estrutura do repositório.
- **Divergência_Doc**: Situação em que a documentação descreve um estado diferente do que o código realmente implementa.
- **Risco**: Condição identificada no repositório que pode causar dificuldades de manutenção, erros ou bloqueios operacionais.
- **Severidade**: Classificação do impacto de um risco (Alta, Média, Baixa).

## Requirements

### Requirement 1: Inventário Estrutural do Repositório

**User Story:** Como mantenedor do EscapeKit MCP, quero um inventário estruturado dos diretórios e arquivos presentes na raiz do repositório, para que eu possa identificar o que pertence ao projeto principal e o que é subprojeto, artefato ou lixo acumulado.

#### Acceptance Criteria

1. THE Risk_Map SHALL listar todos os diretórios de primeiro nível do repositório com sua classificação: `projeto-principal`, `subprojeto`, `artefato-gerado`, `documentação` ou `configuração`.
2. WHEN um diretório contiver `node_modules` ou `dist` versionados, THE Risk_Map SHALL sinalizar esse diretório como portador de artefato pesado.
3. THE Risk_Map SHALL quantificar o número de subprojetos identificados na raiz do repositório.
4. IF um diretório não se enquadrar em nenhuma categoria conhecida, THEN THE Risk_Map SHALL classificá-lo como `indefinido` e registrar uma nota de investigação.

---

### Requirement 2: Rastreamento do Estado de Versionamento

**User Story:** Como mantenedor, quero saber o estado atual do git no repositório, para que eu possa entender o risco de perda de trabalho ou de inconsistência entre o código real e o que está registrado no histórico.

#### Acceptance Criteria

1. THE Risk_Map SHALL registrar se o repositório está em Estado_Sujo no momento da análise.
2. WHEN o repositório estiver em Estado_Sujo, THE Risk_Map SHALL listar as categorias de arquivos modificados (ex: código-fonte, configuração, artefatos gerados).
3. THE Risk_Map SHALL identificar se arquivos que deveriam estar no `.gitignore` estão sendo rastreados pelo git.
4. IF artefatos gerados estiverem versionados, THEN THE Risk_Map SHALL registrar esse item como Risco de Severidade Alta.

---

### Requirement 3: Classificação de Riscos por Severidade

**User Story:** Como mantenedor, quero que cada risco identificado tenha uma severidade atribuída, para que eu possa priorizar as intervenções mais críticas primeiro.

#### Acceptance Criteria

1. THE Risk_Map SHALL classificar cada Risco com exatamente uma das seguintes severidades: `Alta`, `Média` ou `Baixa`.
2. THE Risk_Map SHALL definir critérios explícitos de severidade: Alta = bloqueia builds ou causa perda de dados; Média = aumenta Custo_Cognitivo ou pode causar bugs silenciosos; Baixa = impacta organização ou legibilidade sem consequências imediatas.
3. WHEN um Risco de Severidade Alta for identificado, THE Risk_Map SHALL incluir uma ação corretiva recomendada com prazo sugerido.
4. THE Risk_Map SHALL apresentar um resumo executivo com a contagem de riscos por severidade.

---

### Requirement 4: Mapeamento de Componentes por Maturidade

**User Story:** Como mantenedor, quero conhecer a maturidade real de cada componente do EscapeKit MCP, para que eu não trate código placeholder como funcionalidade pronta ao planejar integrações.

#### Acceptance Criteria

1. THE Risk_Map SHALL listar cada componente principal do projeto (CLI, servidor MCP, detectores, transformadores, validadores) com seu status de maturidade: `estável`, `em-desenvolvimento`, `placeholder` ou `ausente`.
2. WHEN um componente tiver status `placeholder`, THE Risk_Map SHALL identificar o arquivo e a função específicos que contêm a implementação mockada.
3. THE Risk_Map SHALL registrar `validate_reality` como Componente_Placeholder e detalhar o comportamento atual observado.
4. IF um componente listado como funcional na documentação estiver com status `placeholder` no código, THEN THE Risk_Map SHALL registrar esse item como Divergência_Doc com Severidade Média.

---

### Requirement 5: Detecção de Divergência entre Documentação e Código

**User Story:** Como mantenedor, quero saber onde a documentação diverge do estado real do código, para que eu não tome decisões baseadas em informações desatualizadas.

#### Acceptance Criteria

1. THE Risk_Map SHALL comparar os componentes descritos na documentação principal com os módulos efetivamente presentes em `src/`.
2. WHEN uma funcionalidade estiver documentada mas sem módulo correspondente em `src/`, THE Risk_Map SHALL registrar como Divergência_Doc de Severidade Média.
3. WHEN métricas de cobertura ou performance estiverem documentadas, THE Risk_Map SHALL indicar se essas métricas foram ou não verificadas contra o estado atual do código.
4. THE Risk_Map SHALL listar os documentos estratégicos presentes no repositório e classificar cada um como `atualizado`, `possivelmente-desatualizado` ou `não-verificável`.

---

### Requirement 6: Análise de Escopo Funcional

**User Story:** Como mantenedor, quero entender se o escopo funcional declarado do projeto é realista dado o estado atual do código, para que eu possa definir limites claros do que está entregue versus o que é roadmap.

#### Acceptance Criteria

1. THE Risk_Map SHALL listar todas as capacidades funcionais declaradas no projeto (análise, transformação, validação, segurança, governança, academia, relatórios, MCP).
2. THE Risk_Map SHALL classificar cada capacidade como `implementada`, `parcialmente-implementada` ou `não-implementada`.
3. WHEN mais de 50% das capacidades declaradas estiverem como `não-implementada` ou `parcialmente-implementada`, THE Risk_Map SHALL registrar "Risco de Escopo Inflado" com Severidade Alta.
4. THE Risk_Map SHALL identificar a capacidade com maior gap entre documentação e implementação real.

---

### Requirement 7: Identificação de Artefatos Pesados e Custo de Clone

**User Story:** Como mantenedor, quero saber quais diretórios pesados estão presentes no repositório, para que eu possa avaliar o impacto no tempo de clone, builds e operações de git.

#### Acceptance Criteria

1. THE Risk_Map SHALL listar os diretórios que contêm `node_modules` ou `dist` dentro da árvore do repositório.
2. THE Risk_Map SHALL estimar o impacto de cada diretório pesado identificado: `impacto-no-clone`, `impacto-no-build`, `impacto-no-git-status`.
3. IF um `node_modules` de subprojeto estiver fora do `.gitignore` do repositório raiz, THEN THE Risk_Map SHALL registrar como Risco de Severidade Alta.
4. THE Risk_Map SHALL recomendar entradas específicas de `.gitignore` para cada artefato pesado identificado.

---

### Requirement 8: Mapa de Custo Cognitivo para Novos Mantenedores

**User Story:** Como líder técnico, quero uma estimativa do custo cognitivo de onboarding para um novo mantenedor, para que eu possa planejar documentação de apoio e reduzir tempo de rampa.

#### Acceptance Criteria

1. THE Risk_Map SHALL calcular um índice de Custo_Cognitivo baseado em: número de subprojetos na raiz, número de tecnologias distintas na stack, proporção de componentes placeholder versus estáveis, e extensão da documentação estratégica.
2. THE Risk_Map SHALL apresentar o Custo_Cognitivo em escala de três níveis: `baixo` (novo mantenedor produtivo em menos de 1 dia), `médio` (1 a 3 dias), `alto` (mais de 3 dias).
3. WHEN o Custo_Cognitivo for classificado como `alto`, THE Risk_Map SHALL listar os três principais fatores contribuintes.
4. THE Risk_Map SHALL sugerir no mínimo três ações concretas para redução do Custo_Cognitivo.

---

### Requirement 9: Rastreabilidade e Atualização do Mapa de Riscos

**User Story:** Como mantenedor, quero que o mapa de riscos seja um artefato vivo e rastreável, para que eu possa revisitá-lo após intervenções e verificar se os riscos foram mitigados.

#### Acceptance Criteria

1. THE Risk_Map SHALL atribuir um identificador único a cada Risco registrado (ex: `RISK-001`, `RISK-002`).
2. WHEN um Risco for mitigado, THE Risk_Map SHALL permitir atualização de status para `mitigado` sem remover o registro histórico.
3. THE Risk_Map SHALL incluir data de criação e data da última revisão no cabeçalho do documento.
4. THE Risk_Map SHALL ser armazenado em `.kiro/specs/repo-maintenance-risk-map/` como arquivo Markdown rastreável por controle de versão.
