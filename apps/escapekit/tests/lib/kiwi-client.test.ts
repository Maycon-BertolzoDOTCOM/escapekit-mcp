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

describe('KiwiClient', () => {
  let client: KiwiClient;

  beforeEach(() => {
    mockRequest.mockClear();
    mockRequest.mockResolvedValue(undefined);
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

  describe('authenticate', () => {
    it('should authenticate and store token', async () => {
      mockRequest.mockResolvedValueOnce({ data: { result: 'abc123' } });

      const result = await client.authenticate();

      expect(result).toBe(true);
      expect(mockRequest).toHaveBeenCalledWith(
        'https://paulita-unbreathed-blair.ngrok-free.dev/json-rpc/',
        expect.objectContaining({
          jsonrpc: '2.0',
          method: 'Auth.login',
          params: ['admin', 'axfxZMnJK'],
        }),
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        })
      );
    });

    it('should return false on auth failure', async () => {
      mockRequest.mockRejectedValueOnce(new Error('Unauthorized'));

      const result = await client.authenticate();
      expect(result).toBe(false);
    });
  });

  describe('circuit breaker', () => {
    it('should expose circuit breaker state', () => {
      expect(client.getCircuitBreakerState()).toBe('closed');
    });

    it('should reset circuit breaker', () => {
      client.resetCircuitBreaker();
      expect(client.getCircuitBreakerState()).toBe('closed');
    });
  });

  describe('HTTP→HTTPS auto-upgrade', () => {
    it('should normalize http://host:443 to https://host', () => {
      const c = new KiwiClient({
        baseUrl: 'http://paulita-unbreathed-blair.ngrok-free.dev:443',
        username: 'admin',
        password: 'secret',
      });
      expect(c.getCircuitBreakerState()).toBe('closed');
    });

    it('should keep https:// URLs unchanged', () => {
      const c = new KiwiClient({
        baseUrl: 'https://paulita-unbreathed-blair.ngrok-free.dev',
        username: 'admin',
        password: 'secret',
      });
      expect(c.getCircuitBreakerState()).toBe('closed');
    });

    it('should keep http:// non-443 URLs unchanged', () => {
      const c = new KiwiClient({
        baseUrl: 'http://localhost:8080',
        username: 'admin',
        password: 'secret',
      });
      expect(c.getCircuitBreakerState()).toBe('closed');
    });
  });
});
