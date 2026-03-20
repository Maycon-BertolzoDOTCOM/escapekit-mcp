import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryHandler, CircuitBreaker, createRetryHandler, createCircuitBreaker } from '../../scripts/kiwi-retry';

describe('RetryHandler', () => {
  let retryHandler: RetryHandler;

  beforeEach(() => {
    retryHandler = createRetryHandler({ maxRetries: 2, initialDelayMs: 10 });
  });

  it('should succeed on first try', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await retryHandler.execute(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');
    
    const result = await retryHandler.execute(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should not retry on auth errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Authentication failed'));
    
    await expect(retryHandler.execute(fn)).rejects.toThrow('Authentication failed');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should not retry on validation errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('This field is required'));
    
    await expect(retryHandler.execute(fn)).rejects.toThrow('This field is required');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = createCircuitBreaker({
      failureThreshold: 2,
      successThreshold: 1,
      timeoutMs: 1000,
    });
  });

  it('should start in closed state', () => {
    expect(circuitBreaker.getState()).toBe('closed');
  });

  it('should open after failure threshold', async () => {
    const failingFn = vi.fn().mockRejectedValue(new Error('fail'));
    
    await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
    await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
    
    expect(circuitBreaker.getState()).toBe('open');
  });

  it('should succeed after half-open', async () => {
    const failFn = vi.fn().mockRejectedValue(new Error('fail'));
    const successFn = vi.fn().mockResolvedValue('success');
    
    // Trigger open
    await expect(circuitBreaker.execute(failFn)).rejects.toThrow();
    await expect(circuitBreaker.execute(failFn)).rejects.toThrow();
    expect(circuitBreaker.getState()).toBe('open');
    
    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Should transition to half-open
    const result = await circuitBreaker.execute(successFn);
    expect(result).toBe('success');
  });
});
