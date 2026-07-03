# Design Document: Kiro Code Strategic Test

## Overview

Este documento descreve o design de um sistema para testar a capacidade do Kiro Code de gerar respostas estratégicas no estilo Akita (Fabio Akita). O teste avalia se o Kiro Code pode pensar estrategicamente sobre problemas técnicos complexos, conectando tecnologia com monetização indireta através de micro-passos concretos.

**Objetivo Principal**: Validar que o Kiro Code pode gerar respostas que:
1. Incluem micro-passos executáveis (arquivos, comandos, repositórios)
2. Conectam tecnologia com geração de autoridade e receita futura
3. Evitam generalidades e são específicas ao contexto do usuário
4. Fornecem código funcional e mínimo quando necessário

**Contexto de Teste**: O teste será aplicado no contexto do projeto ViralScanner (cockpit de criação de conteúdo), com tecnologias específicas (Crystal, easy-ffmpeg) e foco em monetização indireta via autoridade técnica.

## Architecture

### Componentes do Sistema de Teste

```
┌─────────────────────────────────────────────────────────────┐
│                    Sistema de Teste Kiro Code               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │   Prompt    │    │   Avaliação  │    │   Exemplo  │    │
│  │  Generator  │    │    Engine    │    │   de       │    │
│  │             │    │              │    │  Referência │    │
│  └─────────────┘    └─────────────┘    └─────────────┘    │
│         │                    │                    │       │
│         └─────────────────────┼─────────────────────┘       │
│                              │                              │
│                    ┌─────────▼─────────┐                   │
│                    │   Kiro Code       │                   │
│                    │   (SUT)           │                   │
│                    └─────────┬─────────┘                   │
│                              │                              │
│                    ┌─────────▼─────────┐                   │
│                    │   Resposta        │                   │
│                    │   Gerada         │                   │
│                    └─────────┬─────────┘                   │
│                              │                              │
│                    ┌─────────▼─────────┐                   │
│                    │   Scorecard       │                   │
│                    │   de Avaliação    │                   │
│                    └───────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### Fluxo de Teste

1. **Geração de Prompt**: Criação de cenários técnicos complexos com restrições de monetização
2. **Execução do Kiro Code**: O Kiro Code processa o prompt e gera uma resposta
3. **Avaliação Automática**: Sistema avalia a resposta contra critérios pré-definidos
4. **Pontuação**: Geração de scorecard com métricas de qualidade
5. **Relatório**: Documentação dos resultados e insights

### Componentes Principais

#### 1. Prompt Generator
- Gera prompts técnicos complexos baseados em templates
- Incorpora contexto específico (ViralScanner, Crystal, easy-ffmpeg)
- Adiciona restrições de monetização indireta
- Garante diversidade de cenários de teste

#### 2. Kiro Code (System Under Test)
- Sistema de geração de código e respostas do Kiro
- Processa prompts e gera respostas estratégicas
- Deve demonstrar pensamento estratégico estilo Akita

#### 3. Evaluation Engine
- Analisa respostas geradas contra critérios objetivos
- Verifica presença de micro-passos concretos
- Avalia conexão com monetização indireta
- Detecta generalidades e falta de especificidade
- Valida código funcional (quando aplicável)

#### 4. Reference Example Store
- Armazena exemplos de alta qualidade no estilo Akita
- Serve como benchmark para avaliação
- Fornece padrões de formatação e estrutura

## Components and Interfaces

### Prompt Generator Component

**Responsabilidade**: Criar prompts de teste que simulam problemas técnicos complexos com restrições de negócio.

**Interface**:
```typescript
interface PromptGenerator {
  generatePrompt(context: TestContext): GeneratedPrompt;
}

interface TestContext {
  project: "ViralScanner";
  technologies: ["Crystal", "easy-ffmpeg"];
  businessModel: "indirect_monetization";
  constraints: string[];
}

interface GeneratedPrompt {
  id: string;
  text: string;
  expectedCriteria: EvaluationCriteria[];
  contextTags: string[];
}
```

**Exemplo de Prompt Gerado**:
```
"Estou desenvolvendo o ViralScanner, um cockpit de criação de conteúdo que usa Crystal e easy-ffmpeg. 
Preciso de uma funcionalidade que processe vídeos de forma eficiente em termos de memória (máximo 10MB por processo). 
Não quero criar um SaaS direto, mas gerar autoridade técnica que possa levar a consultorias e cursos. 
Qual micro-passo concreto você sugere para começar hoje?"
```

### Kiro Code Interface

**Responsabilidade**: Processar prompts e gerar respostas estratégicas.

**Interface Esperada**:
```typescript
interface KiroCodeResponse {
  id: string;
  promptId: string;
  generatedText: string;
  timestamp: Date;
  metadata: {
    containsCode: boolean;
    containsConcreteStep: boolean;
    containsMonetizationLink: boolean;
  };
}
```

**Exemplo de Resposta Esperada**:
```
"Rode `crystal init app viral_video_worker`. 
Dentro de `src/viral_video_worker.cr`, cole o código abaixo que usa easy-ffmpeg para processar vídeos com apenas 6MB de RAM:

```crystal
require "easy-ffmpeg"

class ViralVideoWorker
  def process_video(input_path : String, output_path : String)
    # Código mínimo e funcional aqui
  end
end
```

Justificativa estratégica: Processar vídeos on-premise com Crystal permite cobrar premium vs soluções cloud, 
e o baixo consumo de RAM (6MB) é um argumento de venda para o plano Enterprise do ViralScanner."
```

### Evaluation Engine Component

**Responsabilidade**: Avaliar respostas geradas contra critérios objetivos.

**Interface**:
```typescript
interface EvaluationEngine {
  evaluateResponse(response: KiroCodeResponse): EvaluationResult;
}

interface EvaluationResult {
  score: number; // 0-100
  criteriaResults: CriteriaResult[];
  passed: boolean;
  feedback: string[];
}

interface CriteriaResult {
  criterion: string;
  passed: boolean;
  evidence: string;
  weight: number;
}
```

**Crit��rios de Avaliação**:
1. **C1 - Micro-passo Concreto**: Resposta inclui arquivo específico, comando ou repositório
2. **C2 - Conexão Monetização**: Justificativa conecta tecnologia com receita futura
3. **C3 - Evita Generalidades**: Não sugere "faça SaaS" ou "escreva artigo" genérico
4. **C4 - Código Funcional**: Código fornecido (se houver) é executável e mínimo
5. **C5 - Contexto ViralScanner**: Considera tecnologias Crystal e easy-ffmpeg

### Reference Example Store

**Responsabilidade**: Armazenar e fornecer exemplos de referência de alta qualidade.

**Interface**:
```typescript
interface ReferenceExampleStore {
  getExampleById(id: string): ReferenceExample;
  getExamplesByCriteria(criteria: string[]): ReferenceExample[];
  addExample(example: ReferenceExample): void;
}

interface ReferenceExample {
  id: string;
  prompt: string;
  response: string;
  qualityScore: number;
  strengths: string[];
  usedAsBenchmark: boolean;
}
```

## Data Models

### Prompt Data Model
```yaml
Prompt:
  id: UUID
  text: String
  context:
    project: String
    technologies: Array[String]
    business_constraints: Array[String]
    monetization_model: String
  created_at: DateTime
  metadata:
    difficulty_level: "low" | "medium" | "high"
    expected_response_type: "code" | "strategy" | "both"
```

### Response Data Model
```yaml
Response:
  id: UUID
  prompt_id: UUID (foreign key)
  generated_text: String
  evaluation_result: EvaluationResult
  timestamp: DateTime
  model_version: String
  contains:
    concrete_step: Boolean
    code_snippet: Boolean
    monetization_link: Boolean
    viralscanner_context: Boolean
```

### Evaluation Result Data Model
```yaml
EvaluationResult:
  response_id: UUID (foreign key)
  overall_score: Float
  criteria_scores:
    c1_score: Float  # Micro-passo concreto
    c2_score: Float  # Conexão monetização
    c3_score: Float  # Evita generalidades
    c4_score: Float  # Código funcional
    c5_score: Float  # Contexto ViralScanner
  passed: Boolean
  feedback: Array[String]
  evaluator: "automatic" | "human"
  evaluation_date: DateTime
```

### Test Run Data Model
```yaml
TestRun:
  id: UUID
  name: String
  description: String
  prompts_used: Array[UUID]
  start_time: DateTime
  end_time: DateTime
  results:
    total_responses: Integer
    passed_responses: Integer
    average_score: Float
    distribution: Map[ScoreRange, Count]
  summary: String
```

## Data Models (Continuação)

### Scorecard Data Model
```yaml
Scorecard:
  test_run_id: UUID (foreign key)
  generated_at: DateTime
  metrics:
    overall_performance: Float
    strength_areas: Array[String]
    improvement_areas: Array[String]
    benchmark_comparison: Map[String, Float]
  recommendations:
    for_kiro_code: Array[String]
    for_test_system: Array[String]
  visualizations:
    score_distribution: ChartData
    criteria_breakdown: ChartData
    time_trend: ChartData
```

### Benchmark Data Model
```yaml
Benchmark:
  id: UUID
  name: String
  description: String
  reference_examples: Array[UUID]
  target_scores:
    minimum_passing_score: Float
    excellent_score: Float
  created_by: String
  created_at: DateTime
  version: String
```

## Data Flow

1. **Prompt Generation Flow**:
   ```
   Context Input → Prompt Template → Context Enrichment → Generated Prompt
   ```

2. **Response Generation Flow**:
   ```
   Generated Prompt → Kiro Code Processing → Response Generation → Response Output
   ```

3. **Evaluation Flow**:
   ```
   Response Output → Criteria Checking → Score Calculation → Feedback Generation → Evaluation Result
   ```

4. **Reporting Flow**:
   ```
   Multiple Evaluation Results → Aggregation → Scorecard Generation → Insights Extraction → Final Report
   ```

## Storage Considerations

### Volatile Storage (Durante Teste)
- **Redis**: Para caching de prompts e respostas durante execução
- **Memory**: Para dados temporários de avaliação

### Persistent Storage (Resultados)
- **PostgreSQL**: Para resultados de teste, avaliações e métricas históricas
- **S3/MinIO**: Para armazenar exemplos de referência e logs detalhados
- **Elasticsearch**: Para busca e análise de padrões nas respostas

### Backup Strategy
- Backups diários dos resultados de teste
- Versionamento de exemplos de referência
- Logs de auditoria para rastreabilidade

## Performance Requirements

### Tempo de Resposta
- Geração de prompt: < 100ms
- Processamento pelo Kiro Code: < 30 segundos (configurável)
- Avaliação automática: < 5 segundos
- Geração de scorecard: < 10 segundos

### Throughput
- Suporte a 10 testes concorrentes
- Processamento de 100 prompts por hora
- Armazenamento para 10.000 resultados históricos

### Recursos
- Memória: 2GB mínimo para servidor de avaliação
- CPU: 2 cores para processamento paralelo
- Storage: 50GB para dados persistentes

## Security Considerations

### Proteção de Dados
- Anonimização de prompts que contenham informações sensíveis
- Criptografia de dados em repouso
- Controle de acesso baseado em roles

### Integridade do Teste
- Assinatura digital de resultados
- Logs imutáveis de execução
- Verificação de consistência de dados

### Privacidade
- Consentimento explícito para uso de dados de teste
- Opção de exclusão de dados pessoais
- Conformidade com LGPD/GDPR