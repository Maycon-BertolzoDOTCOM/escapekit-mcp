# Implementation Plan: pbt-core-invariants

## Overview

Create five property-based test files (3 TypeScript with fast-check, 2 Python with Hypothesis)
that verify the core systemic invariants of the EscapeKit / CodeMemória codebase.

## Tasks

- [ ] 1. Set up `tests/property/` directory and verify fast-check import
  - Create `tests/property/` directory with a `.gitkeep` or by placing the first test file
  - Confirm fast-check can be imported by checking `node_modules/fast-check` exists
  - No vitest config changes needed — the default glob already picks up `**/*.test.ts`
  - _Requirements: 1.1, 4.1, 5.1_

- [ ] 2. Implement `tests/property/risk-level.pbt.test.ts`
  - Import `computeRiskLevel` from `../../src/governance/GovernanceEngine.js`
  - Define `issueArb` and `stampArb` inline using `fc.record` / `fc.constantFrom`
  - [ ] 2.1 Write property test for Property 1 — output is always a valid RiskLevel
    - `fc.assert(fc.property(issueArb, stampArb, ...), { numRuns: 1000 })`
    - Assert result is one of `'low' | 'medium' | 'high' | 'critical'`
    - _Requirements: 1.1_
  - [ ]* 2.2 Write property test for Property 2 — error severity always produces 'critical'
    - Generate issues array with at least one `severity === 'error'`
    - **Property 2: Error severity always produces 'critical'**
    - **Validates: Requirements 1.2**
  - [ ]* 2.3 Write property test for Property 3 — warning + low compliance score produces 'high'
    - Filter stamps so `avg(scores) < 0.7`, minLength 1; no error-severity issues
    - **Property 3: Warning + low compliance score produces 'high'**
    - **Validates: Requirements 1.3**
  - [ ]* 2.4 Write property test for Property 4 — warning + high compliance (or empty stamps) produces 'medium'
    - Use `fc.oneof(fc.constant([]), fc.array(stampArb).filter(avg >= 0.7))`; no error-severity issues
    - **Property 4: Warning + high compliance score (or empty stamps) produces 'medium'**
    - **Validates: Requirements 1.4, 1.7**
  - [ ]* 2.5 Write property test for Property 5 — no warnings or errors always produces 'low'
    - Generate issues with only `'info'` severity (or empty array)
    - **Property 5: No warnings or errors always produces 'low'**
    - **Validates: Requirements 1.5**
  - [ ]* 2.6 Write property test for Property 6 — computeRiskLevel is deterministic
    - Call `computeRiskLevel` twice with same args; assert results are equal
    - **Property 6: computeRiskLevel is deterministic**
    - **Validates: Requirements 1.6**

- [ ] 3. Implement `tests/property/circuit-breaker.pbt.test.ts`
  - Import `CircuitBreaker` and `CircuitOpenError` from `../../src/utils/circuitBreaker.js`
  - Use `let now = 0; const clock = () => now;` pattern; reset per test in `beforeEach`
  - Define `opArb = fc.array(fc.record({ kind: fc.constantFrom('success', 'failure') }), { maxLength: 50 })`
  - [ ] 3.1 Write property test for Property 15 — state is always valid
    - Apply random op sequence; assert `getStats().state` is one of the three valid states
    - **Property 15: CircuitBreaker state is always valid**
    - **Validates: Requirements 4.1**
  - [ ]* 3.2 Write property test for Property 16 — counters are always non-negative
    - Apply random op sequence; assert `failureCount >= 0` and `successCount >= 0` after each step
    - **Property 16: CircuitBreaker counters are always non-negative**
    - **Validates: Requirements 4.2, 4.3**
  - [ ]* 3.3 Write property test for Property 17 — failureThreshold consecutive failures open the circuit
    - Generate random `threshold >= 1`; apply exactly `threshold` failures from CLOSED; assert state is OPEN
    - **Property 17: failureThreshold consecutive failures open the circuit**
    - **Validates: Requirements 4.4**
  - [ ]* 3.4 Write property test for Property 18 — success in HALF_OPEN closes the circuit
    - Drive breaker to HALF_OPEN deterministically; execute one success; assert CLOSED and failureCount === 0
    - **Property 18: Success in HALF_OPEN closes the circuit**
    - **Validates: Requirements 4.5**
  - [ ]* 3.5 Write property test for Property 19 — failure in HALF_OPEN re-opens the circuit
    - Drive breaker to HALF_OPEN deterministically; execute one failure; assert OPEN
    - **Property 19: Failure in HALF_OPEN re-opens the circuit**
    - **Validates: Requirements 4.6**
  - [ ]* 3.6 Write property test for Property 20 — clock-driven recovery allows execution
    - Drive breaker to OPEN; advance `now` by at least `recoveryTimeoutMs`; assert `canExecute()` is true
    - **Property 20: Clock-driven recovery allows execution**
    - **Validates: Requirements 4.7**
  - [ ]* 3.7 Write property test for Property 21 — reset() always produces CLOSED with zero failureCount
    - Apply random op sequence to reach any state; call `reset()`; assert CLOSED and failureCount === 0
    - **Property 21: reset() always produces CLOSED with zero failureCount**
    - **Validates: Requirements 4.8**

- [ ] 4. Checkpoint — run TypeScript PBT suites so far
  - Run `npx vitest --run tests/property/` and verify 0 failures before continuing.
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement `tests/property/fingerprint.pbt.test.ts`
  - Import `computeFingerprint`, `computeSimilarity` from `../../src/governance/utils/fingerprint.js`
  - Define `fingerprintArb` inline: `fc.record({ hash: fc.hexaString({minLength:64,maxLength:64}), astSignature: fc.string(), dependencies: fc.array(fc.string()), complexity: fc.integer({min:0,max:1000}) })`
  - [ ] 5.1 Write property test for Property 22 — complexity is always non-negative
    - Generate random source strings; assert `computeFingerprint(code).complexity >= 0`
    - **Property 22: computeFingerprint complexity is always non-negative**
    - **Validates: Requirements 5.1**
  - [ ]* 5.2 Write property test for Property 23 — hash is deterministic
    - Call `computeFingerprint` twice with same string; assert hashes are equal
    - **Property 23: computeFingerprint hash is deterministic**
    - **Validates: Requirements 5.2**
  - [ ]* 5.3 Write property test for Property 24 — computeSimilarity is always in [0.0, 1.0]
    - Generate random fingerprint pairs (including empty deps and complexity=0 edge cases); assert result in bounds
    - **Property 24: computeSimilarity is always in [0.0, 1.0]**
    - **Validates: Requirements 5.3, 5.6, 5.7**
  - [ ]* 5.4 Write property test for Property 25 — computeSimilarity is reflexive
    - Generate random fingerprint; assert `computeSimilarity(fp, fp) === 1.0`
    - **Property 25: computeSimilarity is reflexive**
    - **Validates: Requirements 5.4**
  - [ ]* 5.5 Write property test for Property 26 — computeSimilarity symmetry check
    - Generate random fingerprint pairs; assert `computeSimilarity(a, b) === computeSimilarity(b, a)`
    - Comment documents that symmetry is expected to hold; counterexample logged if found
    - **Property 26: computeSimilarity symmetry check (documentation property)**
    - **Validates: Requirements 5.5**

- [ ] 6. Implement `federated-server/tests/test_federated_bounds.py`
  - Import `main` module, `_InMemoryStore`, `app`, `TestClient` from `starlette.testclient`
  - Replace `main._store` with a fresh `_InMemoryStore()` before each test (same pattern as `test_stats.py`)
  - Define `vector_st` strategy: 384-element float list normalised to unit vector; include zero vector via `st.one_of`
  - [ ] 6.1 Write property test for Property 7 — success_rate is always in [0.0, 1.0]
    - Push a pattern with random `success_count` / `total_pushes`; query and assert `success_rate` in bounds
    - Include zero-vector edge case (Requirement 2.5): assert `confidence == 0.0`
    - `@settings(max_examples=200)`
    - **Property 7: success_rate is always in [0.0, 1.0]**
    - **Validates: Requirements 2.1, 2.5**
  - [ ]* 6.2 Write property test for Property 8 — success_rate exact value when success_count <= total_pushes
    - Test arithmetic formula directly: `min(1.0, sc / max(1, tp))` where `sc <= tp`
    - **Property 8: success_rate exact value when success_count <= total_pushes**
    - **Validates: Requirements 2.2**
  - [ ]* 6.3 Write property test for Property 9 — success_rate capped at 1.0 when success_count > total_pushes
    - Test arithmetic formula directly: `min(1.0, sc / max(1, tp))` where `sc > tp`
    - **Property 9: success_rate is capped at 1.0 when success_count > total_pushes**
    - **Validates: Requirements 2.3**
  - [ ]* 6.4 Write property test for Property 10 — confidence is always in [0.0, 1.0]
    - Generate random 384-dim vectors; push pattern; query; assert `confidence` in bounds
    - `@settings(max_examples=200)`
    - **Property 10: confidence is always in [0.0, 1.0]**
    - **Validates: Requirements 2.4**

- [ ] 7. Implement `federated-server/tests/test_credit_tracker.py`
  - Pure-logic tests — no JS import; reimplement the three invariants as Python functions
  - Define `ensure_month(state, current_month)`, `get_remaining(used, limit)`, `increment(state, provider_id)`
  - Define strategies: `provider_id_st`, `limit_st`, `used_count_st`, `n_calls_st`, `month_st`
  - [ ] 7.1 Write property test for Property 11 — _ensureMonth is idempotent within same month
    - Call `ensure_month` N times with same month; assert state equals result of single call
    - `@settings(max_examples=1000)`
    - **Property 11: _ensureMonth is idempotent within the same calendar month**
    - **Validates: Requirements 3.1**
  - [ ]* 7.2 Write property test for Property 12 — month boundary crossing resets counters
    - Advance clock from monthA to a different monthB; assert counters reset to `{}` and month updated
    - **Property 12: Month boundary crossing resets counters**
    - **Validates: Requirements 3.2**
  - [ ]* 7.3 Write property test for Property 13 — getState remaining equals max(0, limit - used)
    - Generate `(provider_id, limit, used)`; assert `get_remaining(used, limit) == max(0, limit - used)`
    - Include `limit == 0` edge case: assert result is `None`
    - **Property 13: getState remaining equals max(0, limit - used)**
    - **Validates: Requirements 3.3, 3.4**
  - [ ]* 7.4 Write property test for Property 14 — increment round-trip
    - Set counter to `initialUsed`; call `increment`; assert `used == initialUsed + 1`
    - **Property 14: increment round-trip**
    - **Validates: Requirements 3.5**

- [ ] 8. Final checkpoint — run all 5 test files and verify 0 failures
  - Run `npx vitest --run tests/property/` (3 TS files, 26 properties total)
  - Run `cd federated-server && python -m pytest tests/test_federated_bounds.py tests/test_credit_tracker.py -v` (2 Python files, 8 properties total)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Properties 8 and 9 test the arithmetic formula directly (no HTTP call needed)
- `test_credit_tracker.py` uses pure Python logic — no Node.js subprocess required
- The symmetry property (26) is asserting; a counterexample would document a known limitation
- CircuitBreaker properties 17–19 drive the breaker to the required state deterministically before asserting
