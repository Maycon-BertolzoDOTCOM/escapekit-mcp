/**
 * Boilerplate Generator
 * Gera esqueleto de código para detectores baseados em contratos factuais
 */

import axios from 'axios';
import yaml from 'js-yaml';

export interface BoilerplateCode {
  detectorName: string;
  code: string;
  testCode?: string;
}

export interface BoilerplateGeneratorOptions {
  model?: string;
  ollamaUrl: string;
}

export class BoilerplateGenerator {
  private model: string;
  private ollamaUrl: string;

  constructor(options: BoilerplateGeneratorOptions) {
    this.model = options.model || 'qwen2.5:latest';
    this.ollamaUrl = options.ollamaUrl || 'http://localhost:11434';
  }

  /**
   * Gera boilerplate de código a partir do contrato
   */
  async generate(contractYaml: string): Promise<BoilerplateCode> {
    const contract = yaml.load(contractYaml) as any;

    // Extrai nome do detector das regras
    const detectorName = this.extractDetectorName(contract);

    // Gera código principal
    const code = await this.generateDetectorCode(contract, detectorName);

    // Gera testes (opcional)
    const testCode = await this.generateTestCode(contract, detectorName);

    return {
      detectorName,
      code,
      testCode,
    };
  }

  /**
   * Extrai nome do detector das regras do contrato
   */
  private extractDetectorName(contract: any): string {
    const rules = contract.rules || [];
    for (const rule of rules) {
      if (rule.action === 'implement_detector' && rule.detector_name) {
        return rule.detector_name;
      }
    }
    // Gera nome padrão baseado no título
    const baseName = contract.source.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .substring(0, 30);
    return `${baseName}-detector`;
  }

  /**
   * Gera código do detector
   */
  private async generateDetectorCode(
    contract: any,
    _detectorName: string
  ): Promise<string> {
    const prompt = `Você é um engenheiro de software especialista em segurança de IA.
Gere um ESQUELETO DE CÓDIGO TypeScript para um detector de segurança baseado no contrato factual abaixo.

## Contrato Factual

${JSON.stringify(contract, null, 2)}

## Instruções

Gere um arquivo TypeScript com:

1. **Imports necessários** (Node.js, TypeScript)
2. **Interfaces/Types** para configurações e resultados do detector
3. **Classe do Detector** com:
   - Construtor que aceita configurações
   - Método \`analyze(code: string): Promise<AnalysisResult>\`
   - Método \`validate(code: string): Promise<ValidationResult>\`
4. **Implementação básica** baseada nas regras do contrato
5. **Comentários JSDoc** explicando cada método
6. **TODOs** marcando onde a lógica específica deve ser implementada

## Regras do Contrato para Implementar

${contract.rules.map((r: any) => `- ${r.principle} (Ação: ${r.action})`).join('\n')}

## Casos para Cobrir

${contract.cases.map((c: any) => `- ${c.description} (Vetor: ${c.attack_vector})`).join('\n')}

Gere APENAS o código TypeScript, sem explicações adicionais:`;

    const response = await this.callOllama(prompt);
    return this.extractCode(response);
  }

  /**
   * Gera código de testes
   */
  private async generateTestCode(
    contract: any,
    _detectorName: string
  ): Promise<string> {
    const prompt = `Você é um engenheiro de QA especialista em testes de segurança.
Gere um ARQUIVO DE TESTES TypeScript usando Vitest para o detector baseado no contrato factual.

## Contrato Factual

${JSON.stringify(contract, null, 2)}

## Instruções

Gere testes com:

1. **Testes unitários** para cada método do detector
2. **Testes de integração** baseados nos casos do contrato
3. **Testes de borda** para validação de entrada
4. **Mocks** quando necessário
5. **Assertions claras** com mensagens descritivas

Use Vitest como framework de testes.

Gere APENAS o código TypeScript, sem explicações adicionais:`;

    const response = await this.callOllama(prompt);
    return this.extractCode(response);
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
        temperature: 0.2,
        options: {
          num_predict: 4096,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 180000, // 3 minutos
      }
    );

    return response.data.response || '';
  }

  /**
   * Extrai código da resposta
   */
  private extractCode(response: string): string {
    // Tenta encontrar bloco TypeScript
    const tsBlockMatch = response.match(/```(?:typescript|ts)\s*([\s\S]*?)\s*```/);
    if (tsBlockMatch) {
      return tsBlockMatch[1].trim();
    }

    // Tenta bloco genérico
    const codeBlockMatch = response.match(/```\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    return response.trim();
  }
}
