/**
 * Testes para Contract Generator
 * Testa geração de contratos YAML usando IA (Ollama)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { ContractGenerator } from '../src/engines/contract-generator.js';
import { mockOllamaResponse, mockValidContract } from './mocks.js';

// Mock do axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('ContractGenerator', () => {
  let generator: ContractGenerator;

  beforeEach(() => {
    generator = new ContractGenerator({
      ollamaUrl: 'http://localhost:11434',
      model: 'qwen2.5:latest',
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('checkOllama', () => {
    it('deve verificar se Ollama está rodando', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { models: [] } });

      // Não deve lançar erro
      await expect(generator['checkOllama']()).resolves.not.toThrow();
      expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:11434/api/tags');
    });

    it('deve lançar erro se Ollama não estiver rodando', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(generator['checkOllama']()).rejects.toThrow('Ollama não está rodando');
    });
  });

  describe('generate', () => {
    const mockMetadata = {
      title: 'Test Paper',
      authors: 'Silva, João; Santos, Maria',
      year: 2024,
      abstract: 'Test abstract about security',
      url: 'https://example.com/paper',
      doi: '10.1234/test',
      sourceType: 'doi' as const,
    };

    it('deve gerar contrato YAML válido com metadados', async () => {
      // Mock da verificação do Ollama
      mockedAxios.get.mockResolvedValueOnce({ data: { models: [] } });
      
      // Mock da geração
      mockedAxios.post.mockResolvedValueOnce({ data: mockOllamaResponse });

      const result = await generator.generate(mockMetadata);

      expect(result).toContain('source:');
      expect(result).toContain('facts:');
      expect(result).toContain('Test Paper');
      expect(result).toContain('Silva, João');
    });

    it('deve usar modelo configurado', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { models: [] } });
      mockedAxios.post.mockResolvedValueOnce({ data: mockOllamaResponse });

      await generator.generate(mockMetadata);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          model: 'qwen2.5:latest',
        }),
        expect.any(Object)
      );
    });

    it('deve extrair YAML de bloco de código markdown', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { models: [] } });
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          response: '```yaml\n' + mockValidContract + '\n```',
        },
      });

      const result = await generator.generate(mockMetadata);

      expect(result).toContain('source:');
      expect(result).not.toContain('```');
    });

    it('deve lançar erro se IA retornar formato inesperado', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { models: [] } });
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          response: 'Desculpe, não entendi o pedido.',
        },
      });

      await expect(generator.generate(mockMetadata)).rejects.toThrow(
        'IA não retornou um contrato YAML válido'
      );
    });

    it('deve lançar erro se resposta estiver vazia', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { models: [] } });
      mockedAxios.post.mockResolvedValueOnce({
        data: { response: '' },
      });

      await expect(generator.generate(mockMetadata)).rejects.toThrow(
        'IA não retornou um contrato YAML válido'
      );
    });

    it('deve incluir metadados no prompt', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { models: [] } });
      mockedAxios.post.mockResolvedValueOnce({ data: mockOllamaResponse });

      await generator.generate(mockMetadata);

      const callArgs = mockedAxios.post.mock.calls[0];
      const requestBody = callArgs[1] as any;
      
      expect(requestBody.prompt).toContain('Test Paper');
      expect(requestBody.prompt).toContain('Silva, João');
      expect(requestBody.prompt).toContain('Test abstract about security');
    });

    it('deve usar temperatura configurada', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { models: [] } });
      mockedAxios.post.mockResolvedValueOnce({ data: mockOllamaResponse });

      const customGenerator = new ContractGenerator({
        ollamaUrl: 'http://localhost:11434',
        temperature: 0.5,
      });

      await customGenerator.generate(mockMetadata);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          temperature: 0.5,
        }),
        expect.any(Object)
      );
    });
  });

  describe('buildPrompt', () => {
    it('deve construir prompt estruturado com todos os metadados', () => {
      const metadata = {
        title: 'Security in AI Systems',
        authors: 'Alice; Bob',
        year: 2024,
        abstract: 'This paper studies security vulnerabilities in AI.',
        url: 'https://example.com/paper',
        doi: '10.1234/security',
        sourceType: 'doi' as const,
      };

      const prompt = generator['buildPrompt'](metadata);

      expect(prompt).toContain('Security in AI Systems');
      expect(prompt).toContain('Alice; Bob');
      expect(prompt).toContain('2024');
      expect(prompt).toContain('This paper studies security vulnerabilities');
      expect(prompt).toContain('source:');
      expect(prompt).toContain('facts:');
      expect(prompt).toContain('patterns:');
      expect(prompt).toContain('rules:');
      expect(prompt).toContain('cases:');
    });

    it('deve lidar com metadados ausentes', () => {
      const metadata = {
        title: 'Paper Without Authors',
        year: 2024,
        url: 'https://example.com/paper',
        sourceType: 'url' as const,
      };

      const prompt = generator['buildPrompt'](metadata as any);

      expect(prompt).toContain('Paper Without Authors');
      expect(prompt).toContain('Unknown'); // Autores padrão
    });
  });

  describe('extractYaml', () => {
    it('deve extrair YAML de bloco ```yaml', () => {
      const response = 'Aqui está o YAML:\n\n```yaml\nsource:\n  title: Test\n```\n\nEspero que ajude!';
      const result = generator['extractYaml'](response);
      expect(result).toBe('source:\n  title: Test');
    });

    it('deve extrair YAML de bloco ``` genérico', () => {
      const response = '```yaml\nsource:\n  title: Test\nfacts:\n  - id: F001\n```';
      const result = generator['extractYaml'](response);
      expect(result).toBe('source:\n  title: Test\nfacts:\n  - id: F001');
    });

    it('deve retornar null se não encontrar YAML', () => {
      const response = 'Desculpe, não posso ajudar com isso.';
      const result = generator['extractYaml'](response);
      expect(result).toBeNull();
    });

    it('deve retornar resposta direta se parecer YAML', () => {
      const response = 'source:\n  title: Test\nfacts:\n  - id: F001';
      const result = generator['extractYaml'](response);
      expect(result).toBe(response);
    });
  });
});
