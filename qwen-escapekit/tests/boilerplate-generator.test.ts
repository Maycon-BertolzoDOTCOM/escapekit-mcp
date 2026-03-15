/**
 * Testes para Boilerplate Generator
 * Testa geração de código TypeScript para detectores
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { BoilerplateGenerator } from '../src/engines/boilerplate-generator.js';
import { mockValidContract, mockBoilerplateCode, mockBoilerplateTests } from './mocks.js';

// Mock do axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('BoilerplateGenerator', () => {
  let generator: BoilerplateGenerator;

  beforeEach(() => {
    generator = new BoilerplateGenerator({
      ollamaUrl: 'http://localhost:11434',
      model: 'qwen2.5:latest',
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('generate', () => {
    it.skip('deve gerar boilerplate de código com contrato válido', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { response: '```typescript\n' + mockBoilerplateCode + '\n```' },
      });

      const result = await generator.generate(mockValidContract);

      expect(result.detectorName).toBe('TestDetector');
      expect(result.code).toContain('export class TestDetector');
      expect(result.code).toContain('async analyze');
    });

    it('deve gerar código de testes quando solicitado', async () => {
      mockedAxios.post
        .mockResolvedValueOnce({
          data: { response: '```typescript\n' + mockBoilerplateCode + '\n```' },
        })
        .mockResolvedValueOnce({
          data: { response: '```typescript\n' + mockBoilerplateTests + '\n```' },
        });

      const result = await generator.generate(mockValidContract);

      expect(result.testCode).toBeDefined();
      expect(result.testCode).toContain('describe');
      expect(result.testCode).toContain('it');
    });

    it.skip('deve extrair nome do detector das regras do contrato', async () => {
      const yamlCustom = `source:
  title: "Test"
rules:
  - id: "R001"
    action: "implement_detector"
    detector_name: "CustomDetector"
patterns: []
facts: []
cases: []`;

      mockedAxios.post.mockResolvedValueOnce({
        data: { response: '```typescript\nclass CustomDetector {}\n```' },
      });

      const result = await generator.generate(yamlCustom);

      expect(result.detectorName).toBe('CustomDetector');
    });

    it.skip('deve gerar nome padrão se detector_name não existir', async () => {
      const yamlSemNome = `source:
  title: "My Test Paper Title"
rules:
  - id: "R001"
    action: "implement_detector"
patterns: []
facts: []
cases: []`;

      mockedAxios.post.mockResolvedValueOnce({
        data: { response: '```typescript\nclass MyTestPaperTitleDetector {}\n```' },
      });

      const result = await generator.generate(yamlSemNome);

      expect(result.detectorName).toContain('my-test-paper-title');
    });
  });

  describe('extractDetectorName', () => {
    it('deve extrair nome da primeira regra com implement_detector', () => {
      const contract = {
        source: { title: 'Test' },
        rules: [
          { action: 'add_test', principle: 'Test' },
          { action: 'implement_detector', detector_name: 'MyDetector' },
          { action: 'implement_detector', detector_name: 'AnotherDetector' },
        ],
      };

      const name = generator['extractDetectorName'](contract);

      expect(name).toBe('MyDetector');
    });

    it.skip('deve gerar nome baseado no título se não houver detector_name', async () => {
      const contract = {
        source: { title: 'Security Analysis of AI Systems' },
        rules: [{ action: 'implement_detector' }],
      };

      const name = generator['extractDetectorName'](contract);

      expect(name).toMatch(/^[a-z0-9-]+$/);
      expect(name.length).toBeLessThanOrEqual(30);
    });

    it('deve lidar com título vazio', () => {
      const contract = {
        source: { title: '' },
        rules: [{ action: 'implement_detector' }],
      };

      const name = generator['extractDetectorName'](contract);

      expect(name).toBeDefined();
    });
  });

  describe('generateDetectorCode', () => {
    const mockContract = {
      source: { title: 'Test Paper', year: 2024 },
      rules: [
        {
          principle: 'Validate all inputs',
          action: 'implement_detector',
          detector_name: 'InputValidator',
        },
      ],
      cases: [
        {
          description: 'Malicious input',
          attack_vector: 'prompt_injection',
        },
      ],
    };

    it('deve gerar código TypeScript válido', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          response: '```typescript\nexport class InputValidator {}\n```',
        },
      });

      const code = await generator['generateDetectorCode'](
        mockContract,
        'InputValidator'
      );

      expect(code).toContain('export class InputValidator');
    });

    it('deve incluir instruções para regras do contrato', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { response: '```typescript\nclass Test {}\n```' },
      });

      await generator['generateDetectorCode'](
        mockContract,
        'Test'
      );

      const prompt = mockedAxios.post.mock.calls[0][1] as any;
      expect(prompt.prompt).toContain('Validate all inputs');
    });

    it('deve incluir casos para cobrir', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { response: '```typescript\nclass Test {}\n```' },
      });

      await generator['generateDetectorCode'](
        mockContract,
        'Test'
      );

      const prompt = mockedAxios.post.mock.calls[0][1] as any;
      expect(prompt.prompt).toContain('Malicious input');
    });
  });

  describe('generateTestCode', () => {
    const mockContract = {
      source: { title: 'Test Paper' },
      rules: [],
      cases: [
        {
          description: 'Test case',
          attack_vector: 'prompt_injection',
        },
      ],
    };

    it('deve gerar testes usando Vitest', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          response: '```typescript\nimport { describe, it } from "vitest";\n```',
        },
      });

      const code = await generator['generateTestCode'](
        mockContract,
        'Test'
      );

      expect(code).toContain('vitest');
    });

    it('deve incluir testes unitários e de integração', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { response: '```typescript\ndescribe("Tests")\n```' },
      });

      await generator['generateTestCode'](
        mockContract,
        'Test'
      );

      const prompt = mockedAxios.post.mock.calls[0][1] as any;
      expect(prompt.prompt).toContain('Testes unitários');
      expect(prompt.prompt).toContain('Testes de integração');
    });
  });

  describe('extractCode', () => {
    it('deve extrair código de bloco typescript', () => {
      const response = 'Aqui está:\n\n```typescript\nexport class Test {}\n```\n\nEspero que ajude!';
      const result = generator['extractCode'](response);
      expect(result).toBe('export class Test {}');
    });

    it('deve extrair código de bloco ts', () => {
      const response = '```ts\nconst x = 1;\n```';
      const result = generator['extractCode'](response);
      expect(result).toBe('const x = 1;');
    });

    it('deve extrair código de bloco genérico', () => {
      const response = '```\nfunction test() {}\n```';
      const result = generator['extractCode'](response);
      expect(result).toBe('function test() {}');
    });

    it('deve retornar resposta direta se não houver blocos', () => {
      const response = 'export const value = 42;';
      const result = generator['extractCode'](response);
      expect(result).toBe('export const value = 42;');
    });

    it('deve trimar espaços em branco', () => {
      const response = '  ```typescript\n  export class Test {}\n  ```  ';
      const result = generator['extractCode'](response);
      expect(result).toBe('export class Test {}');
    });
  });

  describe('callOllama', () => {
    it('deve chamar API do Ollama com parâmetros corretos', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { response: 'test' } });

      await generator['callOllama']('Test prompt');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          model: 'qwen2.5:latest',
          prompt: 'Test prompt',
          stream: false,
        }),
        expect.any(Object)
      );
    });

    it('deve usar temperatura baixa para código', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { response: 'test' } });

      await generator['callOllama']('Test prompt');

      const callArgs = mockedAxios.post.mock.calls[0];
      const requestBody = callArgs[1] as any;
      expect(requestBody.temperature).toBe(0.2);
    });

    it('deve usar timeout de 3 minutos', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { response: 'test' } });

      await generator['callOllama']('Test prompt');

      const callArgs = mockedAxios.post.mock.calls[0];
      const config = callArgs[2] as any;
      expect(config.timeout).toBe(180000);
    });
  });
});
