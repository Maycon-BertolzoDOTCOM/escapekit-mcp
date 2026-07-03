import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { Spinner } from '../../src/cli/Spinner.js';

describe('Spinner', () => {
  let spinner: Spinner;
  let stdoutWriteSpy: vi.SpyInstance;

  beforeEach(() => {
    vi.useFakeTimers();
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    spinner = new Spinner();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should write frame after interval', () => {
    spinner.start('Loading');
    vi.advanceTimersByTime(80);
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('⠋'));
  });

  it('should clear output on stop', () => {
    spinner.start('Loading');
    spinner.stop();
    expect(stdoutWriteSpy).toHaveBeenCalledWith('\r\x1b[K');
  });

  it('should not throw when stop called without start', () => {
    expect(() => spinner.stop()).not.toThrow();
    expect(stdoutWriteSpy).not.toHaveBeenCalled();
  });

  it('should cycle through frames', () => {
    spinner.start('Loading');
    
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(80);
      expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.any(String));
    }
    
    vi.advanceTimersByTime(80);
    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('⠋')); // Back to first frame
  });

  it('should not create multiple intervals on consecutive starts', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    
    spinner.start('First');
    spinner.start('Second');
    
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('should call clearInterval only once per start/stop pair', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    
    spinner.start('Loading');
    spinner.stop();
    spinner.stop();
    
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('should not leak intervals (P4)', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('start', 'stop'), { minLength: 1, maxLength: 100 }),
        (commands) => {
          // Reset spinner state and spy counts before each run
          spinner.stop();
          setIntervalSpy.mockClear();
          clearIntervalSpy.mockClear();
          
          commands.forEach((cmd) => {
            if (cmd === 'start') spinner.start('Loading');
            else spinner.stop();
          });
          
          // clearInterval calls should never exceed setInterval calls
          // At most one interval can be "open" (running) at any time
          const siCount = setIntervalSpy.mock.calls.length;
          const ciCount = clearIntervalSpy.mock.calls.length;
          expect(ciCount).toBeLessThanOrEqual(siCount);
          expect(siCount - ciCount).toBeLessThanOrEqual(1);
          return true;
        }
      )
    );
  });
});