# Requirements Document

## Introduction

The project currently contains two incompatible `RateLimiter` classes with the same name in different
directories: `src/ratelimit/RateLimiter.ts` (window-based throttling, used by sovereignty tests) and
`src/security/RateLimiter.ts` (semaphore + token bucket, used by DeepDependencyScanner and the CLI).
This duplication creates maintenance risk and naming confusion.

This feature unifies both implementations into a single `RateLimiter` class in `src/ratelimit/`,
exposing both APIs under one coherent config interface, then deletes the redundant
`src/security/RateLimiter.ts` and updates all import sites.

## Glossary

- **RateLimiter**: The unified class located at `src/ratelimit/RateLimiter.ts` after this change.
- **RateLimiterConfig**: The single configuration interface accepted by the unified RateLimiter constructor.
- **Token_Bucket**: The fixed-window algorithm that limits how many calls may proceed within `windowMs`.
- **Semaphore**: The concurrency-control mechanism that limits how many `execute()` calls run simultaneously.
- **Throttle_API**: The `throttle() / getRequestCount() / reset()` surface used by sovereignty tests.
- **Execute_API**: The `execute<T>()` / `getStats()` surface used by DeepDependencyScanner and the CLI.
- **Sovereignty_Tests**: `tests/sovereignty/sovereignty.test.ts` and `tests/sovereignty/sovereignty.integration.test.ts`.
- **DeepDependencyScanner**: `src/security/DeepDependencyScanner.ts`.

---

## Requirements

### Requirement 1: Unified Configuration Interface

**User Story:** As a developer, I want a single `RateLimiterConfig` interface that covers both
window-based throttling and concurrency control, so that I only need to learn one API.

#### Acceptance Criteria

1. THE RateLimiter SHALL accept a single `RateLimiterConfig` object with the following optional fields:
   `maxRequests` (number), `windowMs` (number, default 60000), `maxConcurrent` (number, default unlimited),
   and `minDelayMs` (number, default 0).
2. WHEN `RateLimiterConfig` is constructed with no arguments, THE RateLimiter SHALL apply all documented
   defaults without throwing.
3. THE RateLimiter SHALL be TypeScript strict-mode compatible with no implicit `any` types.

---

### Requirement 2: Throttle API (Sovereignty Tests Compatibility)

**User Story:** As a developer running sovereignty tests, I want `throttle()`, `getRequestCount()`, and
`reset()` to behave identically to the previous `src/ratelimit/RateLimiter.ts`, so that no test
modifications are required.

#### Acceptance Criteria

1. WHEN `throttle()` is called, THE RateLimiter SHALL wait until a token is available in the current
   `windowMs` window before resolving.
2. WHEN `minDelayMs` is configured and the elapsed time since the last request is less than `minDelayMs`,
   THE RateLimiter SHALL delay the next `throttle()` call by the remaining difference.
3. WHEN `throttle()` is called N times within a single `windowMs` window and N does not exceed
   `maxRequests`, THE RateLimiter SHALL resolve all N calls without waiting for a new window.
4. WHEN `getRequestCount()` is called, THE RateLimiter SHALL return the number of `throttle()` calls
   that completed within the current `windowMs` window.
5. WHEN `reset()` is called, THE RateLimiter SHALL set `getRequestCount()` to 0 and clear all
   internal timing state.

---

### Requirement 3: Execute API (DeepDependencyScanner Compatibility)

**User Story:** As a developer using DeepDependencyScanner, I want `execute<T>()` and `getStats()` to
behave identically to the previous `src/security/RateLimiter.ts`, so that no scanner or CLI changes
beyond import paths are required.

#### Acceptance Criteria

1. WHEN `execute(fn)` is called, THE RateLimiter SHALL consume one token from the Token_Bucket before
   invoking `fn`.
2. WHILE the number of active `execute()` calls equals `maxConcurrent`, THE RateLimiter SHALL queue
   additional `execute()` calls and resolve them in FIFO order as slots become available.
3. WHEN `fn` throws an error, THE RateLimiter SHALL release the Semaphore slot and re-throw the
   original error.
4. WHEN `getStats()` is called, THE RateLimiter SHALL return an object containing `queued` (number of
   waiting calls), `active` (number of in-flight calls), and `remaining` (tokens left in the current
   window, optional).
5. WHEN `maxConcurrent` is not configured, THE RateLimiter SHALL impose no concurrency limit on
   `execute()` calls.

---

### Requirement 4: Semaphore Slot Release on Error

**User Story:** As a developer, I want the Semaphore to always release its slot even when `fn` throws,
so that the RateLimiter never deadlocks after an error.

#### Acceptance Criteria

1. WHEN `fn` passed to `execute()` throws or rejects, THE RateLimiter SHALL decrement the active count
   and unblock the next queued caller before propagating the error.
2. WHEN `execute()` is called sequentially with a throwing `fn` followed by a non-throwing `fn`, THE
   RateLimiter SHALL successfully execute the second call.

---

### Requirement 5: Import Migration

**User Story:** As a developer, I want all consumers of `src/security/RateLimiter.ts` to be updated to
import from `src/ratelimit/RateLimiter.ts`, so that the deleted file leaves no broken references.

#### Acceptance Criteria

1. THE RateLimiter SHALL be the sole implementation; `src/security/RateLimiter.ts` SHALL be deleted.
2. WHEN `src/security/DeepDependencyScanner.ts` is compiled, THE build SHALL resolve `RateLimiter`
   from `../ratelimit/RateLimiter.js`.
3. WHEN `cli/index.ts` is compiled, THE build SHALL resolve `RateLimiter` from
   `../src/ratelimit/RateLimiter.js`.
4. WHEN `tests/security/DeepDependencyScanner.regression.test.ts` is compiled, THE build SHALL resolve
   `RateLimiter` from `../../src/ratelimit/RateLimiter.js`.
5. WHEN all Sovereignty_Tests are executed without modification, THE test suite SHALL pass.

---

### Requirement 6: No New External Dependencies

**User Story:** As a developer maintaining the project, I want the unified RateLimiter to introduce no
new npm packages, so that the dependency surface stays minimal.

#### Acceptance Criteria

1. THE RateLimiter SHALL implement all throttling and concurrency logic using only TypeScript and
   Node.js built-ins (no `p-limit`, `bottleneck`, or similar packages).

---

### Requirement 7: Correctness Properties

**User Story:** As a developer, I want property-based tests to verify the RateLimiter's invariants,
so that edge cases in timing and concurrency are caught automatically.

#### Acceptance Criteria

1. FOR ALL N where N ≤ `maxRequests`, after N sequential calls to `throttle()` within a single
   `windowMs` window, `getRequestCount()` SHALL equal N (window count invariant).
2. FOR ALL configurations with `maxConcurrent` = K, at no point during concurrent `execute()` calls
   SHALL the number of simultaneously active functions exceed K (concurrency invariant).
3. FOR ALL configurations with `maxRequests` = R and `windowMs` = W, no more than R calls to
   `throttle()` SHALL resolve within any contiguous W-millisecond interval without waiting
   (token bucket invariant).
4. WHEN `reset()` is called at any point, `getRequestCount()` SHALL equal 0 immediately after
   (reset invariant).
5. FOR ALL functions `fn` that throw, `execute(fn)` SHALL release the Semaphore slot such that a
   subsequent `execute()` call with a non-throwing `fn` completes successfully (error-release invariant).
