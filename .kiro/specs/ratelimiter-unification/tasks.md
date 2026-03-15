# Implementation Plan: RateLimiter Unification

## Overview

Merge `src/ratelimit/RateLimiter.ts` and `src/security/RateLimiter.ts` into a single unified class,
update all import sites, delete the redundant file, and add property-based tests.

## Tasks

- [x] 1. Rewrite `src/ratelimit/RateLimiter.ts` with the unified implementation
  - Replace the existing file with the unified class implementing both Throttle API and Execute API
  - Export `RateLimiterConfig` interface with `maxRequests`, `windowMs`, `maxConcurrent`, `minDelayMs`
  - Apply defaults: `maxRequests=Infinity`, `windowMs=60000`, `maxConcurrent=Infinity`, `minDelayMs=0`
  - Implement `throttle()` using sliding-window token bucket with `minDelayMs` support
  - Implement `execute<T>(fn)` as: `throttle()` → `acquireSemaphore()` → `fn()` → `releaseSemaphore()` in finally
  - Implement `getStats()` returning `{ queued, active, remaining? }` (omit `remaining` when `maxRequests` is Infinity)
  - Implement `getRequestCount()` and `reset()` for Throttle API compatibility
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 6.1_

- [x] 2. Update import sites and delete redundant file
  - [x] 2.1 Update `src/security/DeepDependencyScanner.ts`
    - Change import from `./RateLimiter.js` to `../ratelimit/RateLimiter.js`
    - Rename constructor arg `maxPerMinute` → `maxRequests`
    - _Requirements: 5.2_
  - [x] 2.2 Update `cli/index.ts`
    - Change import from `../src/security/RateLimiter.js` to `../src/ratelimit/RateLimiter.js`
    - Rename constructor arg `maxPerMinute` → `maxRequests`
    - _Requirements: 5.3_
  - [x] 2.3 Update `tests/security/DeepDependencyScanner.regression.test.ts`
    - Change import from `../../src/security/RateLimiter.js` to `../../src/ratelimit/RateLimiter.js`
    - Rename constructor arg `maxPerMinute` → `maxRequests`
    - _Requirements: 5.4_
  - [x] 2.4 Delete `src/security/RateLimiter.ts`
    - Remove the file after all import sites are updated
    - _Requirements: 5.1_

- [x] 3. Checkpoint — verify existing tests still pass
  - Run `tests/sovereignty/sovereignty.test.ts` and `tests/sovereignty/sovereignty.integration.test.ts` to confirm Throttle API compatibility
  - Run `tests/security/DeepDependencyScanner.regression.test.ts` to confirm Execute API compatibility
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 5.5_

- [x] 4. Add property-based tests
  - Create `tests/ratelimit/RateLimiter.pbt.test.ts` using `fast-check`
  - Each test runs a minimum of 100 iterations (`{ numRuns: 100 }`)
  - Tag each test with `// Feature: ratelimiter-unification, Property N: <property text>`
  - [x]* 4.1 Write property test for window count invariant
    - **Property 1: Window count invariant** — for N ≤ R sequential `throttle()` calls within one window, `getRequestCount()` equals N
    - Arbitraries: `fc.integer({min:1,max:20})` for R, derive N ≤ R
    - **Validates: Requirements 7.1, 2.4**
  - [x]* 4.2 Write property test for token bucket invariant
    - **Property 2: Token bucket invariant** — no more than R calls resolve within any W-ms interval without waiting
    - Arbitraries: `fc.integer({min:1,max:5})` for R, short `windowMs` to keep tests fast
    - **Validates: Requirements 7.3, 2.1, 2.3**
  - [x]* 4.3 Write property test for concurrency invariant
    - **Property 3: Concurrency invariant** — active in-flight count never exceeds `maxConcurrent`
    - Arbitraries: `fc.integer({min:1,max:10})` for K, `fc.integer({min:K+1,max:K+5})` for concurrent call count
    - **Validates: Requirements 7.2, 3.2**
  - [x]* 4.4 Write property test for reset invariant
    - **Property 4: Reset invariant** — `getRequestCount()` returns 0 immediately after `reset()` regardless of prior state
    - Arbitraries: `fc.integer({min:0,max:10})` for number of prior `throttle()` calls
    - **Validates: Requirements 7.4, 2.5**
  - [x]* 4.5 Write property test for error-release invariant
    - **Property 5: Error-release invariant** — after `execute(throwingFn)`, a subsequent `execute(successFn)` completes successfully
    - Arbitraries: `fc.string()` for error message
    - **Validates: Requirements 7.5, 4.1, 3.3**

- [x] 5. Final checkpoint — full test suite
  - Run the full test suite to confirm no regressions
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 5.1–5.5_

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- `execute()` composes `throttle()` + semaphore, so both limits apply to every `execute()` call
- `remaining` is omitted from `getStats()` when `maxRequests` is `Infinity`
- TypeScript compilation (`tsc --noEmit`) validates Requirements 5.1–5.4 without a runtime test
