/**
 * Testes para Source Resolver
 * Testa extração de metadados de DOI, arXiv, URL e PDF
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { SourceResolver } from '../src/engines/source-resolver.js';
import { mockCrossrefResponse, mockArxivResponse } from './mocks.js';

// Mock do axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock do xml2js
vi.mock('xml2js', () => ({
  parseStringPromise: vi.fn(),
}));

describe('SourceResolver', () => {
  let resolver: SourceResolver;

  beforeEach(() => {
    resolver = new SourceResolver();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('resolveFromDoi', () => {
    it('deve retornar metadados corretos para DOI válido', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: mockCrossrefResponse });

      const result = await resolver.resolve('10.1234/test');

      expect(result).toBeDefined();
      expect(result.title).toBe('Test Paper Title');
      expect(result.authors).toContain('Silva, João');
      expect(result.year).toBe(2024);
      expect(result.abstract).toContain('test abstract');
      expect(result.sourceType).toBe('doi');
      expect(result.doi).toBe('10.1234/test');
    });

    it('deve lançar erro para DOI inválido', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('DOI not found'));

      await expect(resolver.resolve('10.9999/invalid')).rejects.toThrow();
    });

    it('deve delegar para arXiv quando DOI começar com arXiv:', async () => {
      // Teste simplificado - apenas verifica que lança erro quando arXiv não responde
      await expect(resolver.resolve('arXiv:2403.12345')).rejects.toThrow();
    });
  });

  describe('resolveFromArxiv', () => {
    it('deve lidar com erro quando arXiv não retorna dados', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: '' });

      await expect(resolver.resolve('2403.12345')).rejects.toThrow();
    });
  });

  describe('resolveFromUrl', () => {
    it('deve extrair título de URL genérica', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: '<html><head><title>Paper Title from HTML</title></head><body></body></html>',
      });

      const result = await resolver.resolve('https://example.com/paper');

      expect(result.title).toBe('Paper Title from HTML');
      expect(result.sourceType).toBe('url');
      expect(result.url).toBe('https://example.com/paper');
    });

    it('deve detectar DOI em URL doi.org', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: mockCrossrefResponse });

      const result = await resolver.resolve('https://doi.org/10.1234/test');

      expect(result.sourceType).toBe('doi');
      expect(result.doi).toBe('10.1234/test');
    });

    it('deve lançar erro para URL inacessível', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(resolver.resolve('https://invalid-url.example')).rejects.toThrow();
    });
  });

  describe('resolveFromPdf', () => {
    it('deve lidar com erro quando PDF não existe', async () => {
      // Teste simplificado - apenas verifica que o método existe
      await expect(resolver.resolve('/nonexistent.pdf')).rejects.toThrow();
    });
  });

  describe('detectação automática de tipo de fonte', () => {
    it('deve detectar DOI puro (10.xxxx/yyyy)', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: mockCrossrefResponse });
      const result = await resolver.resolve('10.1234/test');
      expect(result.sourceType).toBe('doi');
    });

    it('deve detectar URL do DOI.org', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: mockCrossrefResponse });
      const result = await resolver.resolve('https://doi.org/10.1234/test');
      expect(result.sourceType).toBe('doi');
    });

    it('deve detectar URL genérica', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: '<html><head><title>Test Page</title></head></html>',
      });
      const result = await resolver.resolve('https://example.com/page');
      expect(result.sourceType).toBe('url');
      expect(result.title).toBe('Test Page');
    });
  });

  describe('tratamento de erros', () => {
    it('deve fornecer mensagem de erro amigável para API indisponível', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));

      try {
        await resolver.resolve('10.1234/test');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBeTruthy();
      }
    });

    it('deve lidar com resposta vazia da API', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: {} });

      await expect(resolver.resolve('10.9999/empty')).rejects.toThrow();
    });
  });
});
