import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KiwiClient } from '../../src/lib/kiwi-client';

const { mockRequest, mockRetryHandler, mockCircuitBreaker } = vi.hoisted(() => ({
  mockRequest: vi.fn(),
  mockRetryHandler: vi.fn((fn: () => Promise<unknown>) => fn()),
  mockCircuitBreaker: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

vi.mock('../../src/lib/retry', () => ({
  createRetryHandler: vi.fn(() => ({
    execute: mockRetryHandler,
    getHistory: vi.fn(() => []),
  })),
  createCircuitBreaker: vi.fn(() => ({
    execute: mockCircuitBreaker,
    getState: vi.fn(() => 'closed'),
    reset: vi.fn(),
  })),
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post: mockRequest,
      request: mockRequest,
      defaults: { headers: {}, baseURL: '' },
    })),
  },
}));

describe('KiwiClient - Cache', () => {
  let client: KiwiClient;

  beforeEach(() => {
    mockRequest.mockReset();
    mockRequest.mockImplementation(() => Promise.resolve({ data: { result: undefined } }));
    mockRetryHandler.mockImplementation((fn: () => Promise<unknown>) => fn());
    mockCircuitBreaker.mockImplementation((fn: () => Promise<unknown>) => fn());
    client = new KiwiClient({
      baseUrl: 'https://paulita-unbreathed-blair.ngrok-free.dev',
      username: 'admin',
      password: 'axfxZMnJK',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function authRpc(result = 'tok') {
    mockRequest.mockResolvedValueOnce({ data: { result } });
    await client.authenticate();
    mockRequest.mockClear();
  }

  describe('test case cache', () => {
    it('should cache test case lookups', async () => {
      await authRpc();

      mockRequest.mockResolvedValueOnce({
        data: { result: [{ id: 42, summary: 'test-a' }] },
      });
      const result1 = await client.findTestCase('test-a');
      expect(result1?.id).toBe(42);
      expect(mockRequest).toHaveBeenCalledTimes(1);

      const result2 = await client.findTestCase('test-a');
      expect(result2?.id).toBe(42);
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should cache created test cases', async () => {
      await authRpc();

      mockRequest.mockImplementation(async () => {
        const r = mockRequest.mock.results.length;
        if (r === 1) return { data: { result: [] } };
        if (r === 2) return { data: { result: [{ id: 1, name: 'Prod' }] } };
        if (r === 3) return { data: { result: [{ id: 5, name: 'Default' }] } };
        if (r === 4) return { data: { result: { id: 100, summary: 'new-test' } } };
        return { data: { result: [] } };
      });

      const tc = await client.getOrCreateTestCase('new-test', 1, 5);
      expect(tc.id).toBe(100);

      mockRequest.mockClear();
      mockRequest.mockResolvedValueOnce({
        data: { result: { id: 100, summary: 'new-test' } },
      });
      const cached = await client.findTestCase('new-test');
      expect(cached?.id).toBe(100);
    });
  });

  describe('product cache', () => {
    it('should cache product list', async () => {
      await authRpc();

      mockRequest.mockResolvedValueOnce({
        data: { result: [{ id: 1, name: 'Prod' }] },
      });
      await client.listProducts();
      await client.listProducts();
      await client.listProducts();

      expect(mockRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('build cache', () => {
    it('should cache builds per product', async () => {
      await authRpc();

      mockRequest.mockResolvedValueOnce({
        data: { result: [{ id: 10, name: 'Build-1' }] },
      });
      await client.listBuilds(1);
      await client.listBuilds(1);

      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should invalidate build cache on create', async () => {
      await authRpc();

      let step = 0;
      mockRequest.mockImplementation(async () => {
        step++;
        if (step === 1) return { data: { result: [{ id: 10, name: 'Old' }] } };
        if (step === 2) return { data: { result: { id: 20, name: 'New' } } };
        return {
          data: {
            result: [
              { id: 10, name: 'Old' },
              { id: 20, name: 'New' },
            ],
          },
        };
      });

      await client.listBuilds(1);
      await client.createBuild({ name: 'New', product: 1 });
      const builds = await client.listBuilds(1);

      expect(builds).toHaveLength(2);
      expect(mockRequest).toHaveBeenCalledTimes(3);
    });
  });

  describe('clearCache', () => {
    it('should clear all caches', async () => {
      await authRpc();

      mockRequest.mockResolvedValueOnce({
        data: { result: [{ id: 1, name: 'Prod' }] },
      });
      await client.listProducts();

      client.clearCache();

      mockRequest.mockClear();
      await authRpc();
      mockRequest.mockResolvedValueOnce({
        data: { result: [{ id: 1, name: 'Prod' }] },
      });
      await client.listProducts();

      expect(mockRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      await authRpc();

      mockRequest.mockResolvedValueOnce({
        data: { result: [{ id: 42, summary: 'test' }] },
      });
      await client.findTestCase('test');

      const stats = client.getCacheStats();
      expect(stats.testCases).toBe(1);
    });
  });
});

describe('KiwiClient - Validation', () => {
  let client: KiwiClient;

  beforeEach(() => {
    mockRequest.mockReset();
    mockRequest.mockImplementation(() => Promise.resolve({ data: { result: undefined } }));
    mockRetryHandler.mockImplementation((fn: () => Promise<unknown>) => fn());
    mockCircuitBreaker.mockImplementation((fn: () => Promise<unknown>) => fn());
    client = new KiwiClient({
      baseUrl: 'https://paulita-unbreathed-blair.ngrok-free.dev',
      username: 'admin',
      password: 'axfxZMnJK',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function authRpc(result = 'tok') {
    mockRequest.mockResolvedValueOnce({ data: { result } });
    await client.authenticate();
    mockRequest.mockClear();
  }

  describe('validateProduct', () => {
    it('should throw when product not found', async () => {
      await authRpc();

      mockRequest.mockResolvedValueOnce({
        data: { result: [{ id: 1, name: 'Other' }] },
      });

      await expect(client.validateProduct(999)).rejects.toThrow(/Product ID 999 not found/);
    });

    it('should return product when found', async () => {
      await authRpc();

      mockRequest.mockResolvedValueOnce({
        data: { result: [{ id: 1, name: 'EscapeKit' }] },
      });

      const product = await client.validateProduct(1);
      expect(product.name).toBe('EscapeKit');
    });

    it('should skip validation on repeated calls', async () => {
      await authRpc();

      mockRequest.mockResolvedValueOnce({
        data: { result: [{ id: 1, name: 'Prod' }] },
      });

      await client.validateProduct(1);
      await client.validateProduct(1);

      expect(mockRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateCategory', () => {
    it('should throw when category not found', async () => {
      await authRpc();

      mockRequest.mockResolvedValueOnce({
        data: { result: [{ id: 5, name: 'Default' }] },
      });

      await expect(client.validateCategory(1, 999)).rejects.toThrow(/Category ID 999 not found/);
    });

    it('should return category when found', async () => {
      await authRpc();

      mockRequest.mockResolvedValueOnce({
        data: { result: [{ id: 5, name: 'Integration' }] },
      });

      const cat = await client.validateCategory(1, 5);
      expect(cat.name).toBe('Integration');
    });
  });

  describe('getOrCreateTestCase with validation', () => {
    it('should validate product and category before creating', async () => {
      await authRpc();

      let step = 0;
      mockRequest.mockImplementation(async () => {
        step++;
        if (step === 1) return { data: { result: [] } };
        if (step === 2) return { data: { result: [{ id: 1, name: 'Prod' }] } };
        if (step === 3) return { data: { result: [{ id: 5, name: 'Default' }] } };
        return { data: { result: { id: 100, summary: 'new-test' } } };
      });

      const tc = await client.getOrCreateTestCase('new-test', 1, 5);
      expect(tc.id).toBe(100);
    });

    it('should fail if product is invalid', async () => {
      mockRequest.mockImplementation(async () => {
        const calls = mockRequest.mock.results.length;
        if (calls === 0) return { data: { result: undefined } };
        if (calls === 1) return { data: { result: [{ id: 99, name: 'Other' }] } };
        return { data: { result: [] } };
      });

      await expect(client.getOrCreateTestCase('new-test', 1, 5)).rejects.toThrow(
        /Product ID 1 not found/
      );
    });
  });
});
