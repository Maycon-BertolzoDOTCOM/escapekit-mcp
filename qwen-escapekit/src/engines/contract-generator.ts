/**
 * Contract Generator
 * Gera contrato factual YAML usando IA local (Ollama)
 */

import axios from 'axios';
import type { SourceMetadata } from './source-resolver.js';

export interface ContractGeneratorOptions {
  model?: string;
  ollamaUrl: string;
  temperature?: number;
}

export class ContractGenerator {
  private model: string;
  private ollamaUrl: string;
  private temperature: number;

  constructor(options: ContractGeneratorOptions) {
    this.model = options.model || 'qwen2.5:latest';
    this.ollamaUrl = options.ollamaUrl || 'http://localhost:11434';
    this.temperature = options.temperature || 0.3;
  }

  /**
   * Gera contrato factual a partir de metadados
   */
  async generate(metadata: SourceMetadata): Promise<string> {
    // Verifica se Ollama está disponível
    await this.checkOllama();

    // Constrói prompt
    const prompt = this.buildPrompt(metadata);

    // Chama Ollama
    const response = await this.callOllama(prompt);

    // Extrai YAML da resposta
    const yaml = this.extractYaml(response);

    if (!yaml) {
      throw new Error('IA não retornou um contrato YAML válido');
    }

    return yaml;
  }

  /**
   * Verifica se Ollama está rodando
   */
  private async checkOllama(): Promise<void> {
    try {
      await axios.get(`${this.ollamaUrl}/api/tags`);
    } catch (error) {
      throw new Error(
        'Ollama não está rodando. Inicie com: ollama serve\n' +
        'Ou instale: curl -fsSL https://ollama.com/install.sh | sh'
      );
    }
  }

  /**
   * Constrói prompt para extração de contrato
   */
  private buildPrompt(metadata: SourceMetadata): string {
    return `Você é um especialista em análise de papers acadêmicos de segurança de software.
Sua tarefa é extrair informações cruciais do paper e formatá-las como um CONTRATO FACIONAL YAML.

Um contrato factual documenta:
- FATOS: Afirmações verificáveis e objetivas do paper
- PADRÕES: Regularidades identificadas nos fatos
- REGRAS: Princípios de implementação derivados dos padrões
- CASOS: Exemplos concretos de aplicação ou ataque

## Dados do Paper

**Título:** ${metadata.title}
**Autores:** ${metadata.authors || 'Não informado'}
**Ano:** ${metadata.year || 'Não informado'}
**URL:** ${metadata.url}
**DOI:** ${metadata.doi || 'Não informado'}

**Abstract:**
${metadata.abstract || 'Não disponível'}

## Instruções

Gere um YAML com a seguinte estrutura EXATA:

\`\`\`yaml
source:
  title: "${metadata.title}"
  authors: "${metadata.authors || 'Unknown'}"
  year: ${metadata.year || 'unknown'}
  url: "${metadata.url}"
  doi: "${metadata.doi || ''}"
  extracted_at: "${new Date().toISOString()}"

facts:
  - id: "F001"
    statement: "[Fato principal 1 - afirmação verificável do paper]"
    type: "fact"
    relevance: "security"
    location: "Section X.X"

  - id: "F002"
    statement: "[Fato principal 2]"
    type: "fact"
    relevance: "portability"

patterns:
  - id: "P001"
    description: "[Padrão observado baseado nos fatos]"
    evidence: ["F001", "F002"]
    confidence: "high"

rules:
  - id: "R001"
    principle: "[Princípio de implementação derivado do padrão]"
    derived_from: ["P001"]
    action: "implement_detector"
    detector_name: "[NomeDoDetector]"
    priority: "high"

cases:
  - id: "C001"
    description: "[Caso concreto de aplicação ou ataque]"
    attack_vector: "prompt_injection"
    mitigation: "[Mitigação proposta]"
    related_facts: ["F001"]
    related_rules: ["R001"]

metadata:
  version: "1.0"
  status: "draft"
  tags: ["security", "ai-safety"]
\`\`\`

## Regras Importantes

1. Extraia FATOS objetivos, não opiniões
2. Cada fato deve ser verificável no paper
3. Padrões devem ser derivados de múltiplos fatos
4. Regras devem ser acionáveis (implement_detector, add_test, create_polyfill)
5. Casos devem ilustrar aplicações reais ou ataques
6. Responda APENAS com o YAML, sem explicações adicionais
7. Use o idioma do paper (geralmente inglês para termos técnicos)

Responda agora com o contrato YAML:`;
  }

  /**
   * Chama API do Ollama
   */
  private async callOllama(prompt: string): Promise<string> {
    const response = await axios.post(
      `${this.ollamaUrl}/api/generate`,
      {
        model: this.model,
        prompt: prompt,
        stream: false,
        temperature: this.temperature,
        options: {
          num_predict: 2048,
          top_p: 0.9,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 120000, // 2 minutos
      }
    );

    return response.data.response || '';
  }

  /**
   * Extrai YAML da resposta da IA
   */
  private extractYaml(response: string): string | null {
    // Tenta encontrar bloco YAML entre ```yaml e ```
    const yamlBlockMatch = response.match(/```yaml\s*([\s\S]*?)\s*```/);
    if (yamlBlockMatch) {
      return yamlBlockMatch[1].trim();
    }

    // Tenta encontrar bloco genérico (sem linguagem especificada)
    const codeBlockMatch = response.match(/```\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      const content = codeBlockMatch[1].trim();
      // Verifica se parece YAML
      if (content.includes('source:') && (content.includes('facts:') || content.includes('patterns:'))) {
        return content;
      }
    }

    // Se a resposta inteira parece YAML
    if (response.includes('source:') && (response.includes('facts:') || response.includes('patterns:'))) {
      return response.trim();
    }

    return null;
  }
}
