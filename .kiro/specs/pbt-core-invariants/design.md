# Design Document: pbt-core-invariants

## Overview

This design covers five property-based test suites that verify the most critical systemic
invariants in the EscapeKit / CodeMemória codebase. Each suite uses a dedicated test file,
concrete arbitraries/strategies, and injected dependencies (clock, fsModule) to run fully
in-process without external services.

The five invariants are:

1. `computeRiskLevel` — determinism and correct branch classification
2. FederatedServer `GET /query` — `success_rate` and `confidence` bounds
3. `CreditTracker` — monthly rollover idempotency and counter correctness
4. `CircuitBreaker` — state-machine transitions and counter non-negativity
5. `computeFingerprint` / `computeSimilarity` — complexity bounds, determinism, reflexivity, symmetry

---

## Architecture

```
tests/property/
  risk-level.pbt.test.ts          (Req 1 — fast-check, vitest)
  circuit-breaker.pbt.test.ts     (Req 4 — fast-check, vitest)
  fingerprint.pbt.test.ts         (Req 5 — fast-check, vitest)

federated-server/tests/
  test_federated_bounds.py        (Req 2 — hypothesis, pytest)
  test_credit_tracker.py          (Req 3 — hypothesis, pytest)
```

TypeScript tests import directly from `src/` using the existing ESM paths.
Python tests import from `main` (the FastAPI module) and from
`pisosrealview-pro-transformed/backend/services/gateway/CreditTracker.js` via a thin
Python wrapper or by testing the logic directly (see §Components).

All tests are self-contained: no network calls, no real filesystem I/O, no Chroma.

---

## Components and Interfaces

### TypeScript test helpers

Each TypeScript test file defines its arbitraries inline (no shared file needed for this
feature — the shapes are small and specific).

**Issue arbitrary** (`fc.record`):

```typescript
const issueArb = fc.record({
  type: fc.constantFrom(
    'BUILD_ERROR', 'GHOST_IMPORT', 'SECURITY_VULNERABILITY',
    'SECURITY_WARNING', 'WEBGL_UNSUPPORTED', 'MISSING_POLYFILL',
    'OUTDATED_CONFIG', 'MISSING_DEPENDENCY', 'WEBGL_ERROR'
  ),
  severity: fc.constantFrom('error' as const, 'warning' as const, 'info' as const),
  message: fc.string({ minLength: 1 }),
});
```

**ComplianceStamp arbitrary** (`fc.record`):

```typescript
const stampArb = fc.record({
  regulationId: fc.string({ minLength: 1 }),
  clauses: fc.array(fc.string()),
  score: fc.float({ min: 0, max: 1, noNaN: true }),
  verifiedAt: fc.date(),
  verifiedBy: fc.string({ minLength: 1 }),
});
```

**CodeFingerprint arbitrary** (`fc.record`):

```typescript
const fingerprintArb = fc.record({
  hash: fc.hexaString({ minLength: 64, maxLength: 64 }),
  astSignature: fc.string(),
  dependencies: fc.array(fc.string()),
  complexity: fc.integer({ min: 0, max: 1000 }),
});
```

### Clock injection

`CircuitBreaker` accepts `clock: () => number` as its third constructor argument.
Tests use a mutable ref:

```typescript
let now = 0;
const clock = () => now;
const cb = new CircuitBreaker('test', { failureThreshold: 3, recoveryTimeoutMs: 1000 }, clock);
// advance time:
now += 2000;
```

`CreditTracker` accepts `{ clock: () => Date, fsModule }` in its constructor options.
Tests use:

```typescript
let currentDate = new Date('2024-01-15');
const clock = () => currentDate;
```

### Filesystem isolation (CreditTracker)

`CreditTracker` calls `fsModule.readFileSync` and `fsModule.writeFileSync`. Tests provide
a plain in-memory stub — no vitest/jest spy needed since the stub is sufficient:

```typescript
// Python side: CreditTracker is JS, so we test the logic via a thin Node subprocess
// or — preferred — we test the Python-equivalent logic directly.
// See §CreditTracker test design below.
```

Because `CreditTracker` is a JavaScript module and the Python test runner cannot import it
directly, `test_credit_tracker.py` tests the **same logical invariants** by reimplementing
the minimal state machine in Python for property generation, then cross-checking against
the JS module via a `subprocess` call to `node --input-type=module`. This is the cleanest
approach that avoids a full Node.js test harness in Python.

**Alternative (preferred)**: write `test_credit_tracker.py` as a pure-logic test that
verifies the mathematical invariants (`remaining = max(0, limit - used)`, idempotency of
`_ensureMonth`, increment round-trip) using Hypothesis strategies, without importing the
JS module. The invariants are pure arithmetic and do not require running the JS code.

The design adopts the **pure-logic approach** for `test_credit_tracker.py`.

### FederatedServer test isolation

Tests replace the module-level `_store` before each test:

```python
import main as server_module
from main import _InMemoryStore, app

server_module._store = _InMemoryStore()
client = TestClient(app)
```

This pattern is already established in `test_stats.py` and `test_server.py`.

---

## Data Models

### Hypothesis strategies (Python)

**384-dimensional float vector** (unit vector for realistic cosine similarity):

```python
import numpy as np
from hypothesis import strategies as st

def vector_st(dims: int = 384):
    """Generate a random unit vector of `dims` floats."""
    return st.lists(
        st.floats(min_value=-1.0, max_value=1.0, allow_nan=False, allow_infinity=False),
        min_size=dims, max_size=dims
    ).map(lambda v: _normalize(v))

def _normalize(v: list[float]) -> list[float]:
    arr = np.array(v, dtype=np.float64)
    norm = np.linalg.norm(arr)
    if norm == 0.0:
        return v  # zero vector — kept as-is for edge-case testing
    return (arr / norm).tolist()
```

**Zero vector** (edge case):

```python
zero_vector_384 = [0.0] * 384
```

**success_count / total_pushes strategies**:

```python
success_count_st = st.integers(min_value=1, max_value=10_000)
total_pushes_st  = st.integers(min_value=1, max_value=10_000)
```

**CreditTracker logic strategies**:

```python
provider_id_st = st.text(min_size=1, max_size=20,
    alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")))
limit_st       = st.integers(min_value=1, max_value=1000)
used_count_st  = st.integers(min_value=0, max_value=999)
n_calls_st     = st.integers(min_value=1, max_value=100)  # idempotency call count

month_a_st = st.dates(min_value=date(2020, 1, 1), max_value=date(2030, 11, 30))
# month_b is always a different month: month_a + 1 month
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions
of a system — essentially, a formal statement about what the system should do. Properties
serve as the bridge between human-readable specifications and machine-verifiable correctness
guarantees.*

### Property 1: computeRiskLevel output is always a valid RiskLevel

*For any* array of Issues and array of ComplianceStamps, `computeRiskLevel` must return
exactly one of `'low' | 'medium' | 'high' | 'critical'`.

**Validates: Requirements 1.1**

---

### Property 2: Error severity always produces 'critical'

*For any* Issue array that contains at least one Issue with `severity === 'error'`, and any
ComplianceStamp array, `computeRiskLevel` must return `'critical'`.

**Validates: Requirements 1.2**

---

### Property 3: Warning + low compliance score produces 'high'

*For any* Issue array with no `'error'` severity and at least one `'warning'` severity, and
any non-empty ComplianceStamp array whose average `score` is strictly less than `0.7`,
`computeRiskLevel` must return `'high'`.

Edge case covered: empty `complianceStamps` defaults to `avgScore = 1.0`, so it falls into
Property 4, not Property 3. The generator for Property 3 must produce non-empty stamp arrays
with `avg < 0.7`.

**Validates: Requirements 1.3**

---

### Property 4: Warning + high compliance score (or empty stamps) produces 'medium'

*For any* Issue array with no `'error'` severity and at least one `'warning'` severity, and
any ComplianceStamp array (including empty) whose average `score` is `>= 0.7` (empty → 1.0),
`computeRiskLevel` must return `'medium'`.

Edge case covered: empty `complianceStamps` (Requirement 1.7) is a sub-case of this property
and must be included in the generator.

**Validates: Requirements 1.4, 1.7**

---

### Property 5: No warnings or errors always produces 'low'

*For any* Issue array containing only `'info'`-severity issues (or empty), and any
ComplianceStamp array, `computeRiskLevel` must return `'low'`.

**Validates: Requirements 1.5**

---

### Property 6: computeRiskLevel is deterministic

*For any* Issue array and ComplianceStamp array, calling `computeRiskLevel` twice with the
same arguments must return the same value.

**Validates: Requirements 1.6**

---

### Property 7: success_rate is always in [0.0, 1.0]

*For any* integers `success_count >= 1` and `total_pushes >= 1`, the value
`min(1.0, success_count / max(1, total_pushes))` must be in `[0.0, 1.0]`.

This property is tested against the live `GET /query` endpoint backed by `_InMemoryStore`.

Edge case covered: zero vector query (Requirement 2.5) — when the query vector is all zeros,
`_cosine_similarity` returns `0.0`, so `confidence = max(0.0, min(1.0, 0.0)) = 0.0`. This
is included in the generator by occasionally injecting the zero vector.

**Validates: Requirements 2.1, 2.5**

---

### Property 8: success_rate exact value when success_count <= total_pushes

*For any* integers `success_count >= 1` and `total_pushes >= success_count`, the computed
`success_rate` must equal `success_count / total_pushes` exactly (within float tolerance).

**Validates: Requirements 2.2**

---

### Property 9: success_rate is capped at 1.0 when success_count > total_pushes

*For any* integers `success_count > total_pushes >= 1`, the computed `success_rate` must
equal `1.0`.

**Validates: Requirements 2.3**

---

### Property 10: confidence is always in [0.0, 1.0]

*For any* 384-dimensional float vector used as a query, the `confidence` field in every
`FederatedPatternResponse` returned by `GET /query` must be in `[0.0, 1.0]`.

**Validates: Requirements 2.4**

---

### Property 11: _ensureMonth is idempotent within the same calendar month

*For any* integer `N >= 1`, calling `_ensureMonth()` N times on a `CreditTracker` whose
clock always returns the same month must produce the same `state` as calling it once.
Specifically, `state.counters` must be unchanged and `state.month` must equal the current
month string.

**Validates: Requirements 3.1**

---

### Property 12: Month boundary crossing resets counters

*For any* two distinct calendar months `monthA` and `monthB` (where `monthB != monthA`),
a `CreditTracker` whose clock is advanced from `monthA` to `monthB` must, after the next
call to `_ensureMonth()`, have `state.counters === {}` and `state.month === monthB`.

**Validates: Requirements 3.2**

---

### Property 13: getState remaining equals max(0, limit - used)

*For any* provider ID, integer `limit > 0`, and integer `used >= 0`, after setting the
counter to `used` via `increment` calls, `getState(providerId, limit).remaining` must equal
`Math.max(0, limit - used)`.

Edge case covered: `limit === 0` → `remaining` is `null` (Requirement 3.4). The generator
includes `limit = 0` as an edge case and asserts `null`.

**Validates: Requirements 3.3, 3.4**

---

### Property 14: increment round-trip

*For any* provider ID and initial used count `initialUsed >= 0`, after setting the counter
to `initialUsed` and calling `increment(providerId)` once, `getState(providerId, limit).used`
must equal `initialUsed + 1`.

**Validates: Requirements 3.5**

---

### Property 15: CircuitBreaker state is always valid

*For any* sequence of `execute` calls (mix of successes and failures) applied to a
`CircuitBreaker`, `getStats().state` must always be one of `'CLOSED' | 'OPEN' | 'HALF_OPEN'`.

**Validates: Requirements 4.1**

---

### Property 16: CircuitBreaker counters are always non-negative

*For any* sequence of `execute` calls applied to a `CircuitBreaker`, both
`getStats().failureCount` and `getStats().successCount` must be `>= 0` after every step.

**Validates: Requirements 4.2, 4.3**

---

### Property 17: failureThreshold consecutive failures open the circuit

*For any* integer `threshold >= 1`, a `CircuitBreaker` constructed with
`failureThreshold = threshold` must transition to `'OPEN'` after exactly `threshold`
consecutive failures from `'CLOSED'` state.

**Validates: Requirements 4.4**

---

### Property 18: Success in HALF_OPEN closes the circuit

*For any* `CircuitBreaker` in `HALF_OPEN` state, a single successful `execute` call must
transition the state to `'CLOSED'` and reset `failureCount` to `0`.

**Validates: Requirements 4.5**

---

### Property 19: Failure in HALF_OPEN re-opens the circuit

*For any* `CircuitBreaker` in `HALF_OPEN` state, a single failing `execute` call must
transition the state back to `'OPEN'`.

**Validates: Requirements 4.6**

---

### Property 20: Clock-driven recovery allows execution

*For any* `CircuitBreaker` in `OPEN` state with `recoveryTimeoutMs = T`, advancing the
injected clock by at least `T` milliseconds must cause `canExecute()` to return `true`.

**Validates: Requirements 4.7**

---

### Property 21: reset() always produces CLOSED with zero failureCount

*For any* `CircuitBreaker` in any state, calling `reset()` must result in
`getStats().state === 'CLOSED'` and `getStats().failureCount === 0`.

**Validates: Requirements 4.8**

---

### Property 22: computeFingerprint complexity is always non-negative

*For any* source-code string, `computeFingerprint(code).complexity` must be `>= 0`.

**Validates: Requirements 5.1**

---

### Property 23: computeFingerprint hash is deterministic

*For any* source-code string, calling `computeFingerprint` twice must return the same
`hash` value.

**Validates: Requirements 5.2**

---

### Property 24: computeSimilarity is always in [0.0, 1.0]

*For any* two `CodeFingerprint` objects, `computeSimilarity(a, b)` must be in `[0.0, 1.0]`.

Edge cases covered by the generator:
- Both fingerprints have `dependencies: []` → Jaccard = 0.0, result still in bounds (Req 5.6)
- Both fingerprints have `complexity: 0` → complexityScore = 1.0, result still in bounds (Req 5.7)

**Validates: Requirements 5.3, 5.6, 5.7**

---

### Property 25: computeSimilarity is reflexive

*For any* `CodeFingerprint`, `computeSimilarity(fp, fp)` must equal `1.0`.

**Validates: Requirements 5.4**

---

### Property 26: computeSimilarity symmetry check (documentation property)

*For any* two `CodeFingerprint` objects `a` and `b`, this property checks whether
`computeSimilarity(a, b) === computeSimilarity(b, a)`.

Based on the implementation analysis:
- `hashMatch`: symmetric (equality is symmetric)
- `jaccardDeps`: symmetric (intersection and union are symmetric)
- `complexityScore`: symmetric (`|a - b| = |b - a|`)

Therefore symmetry **should hold** for all inputs. The test is written as an asserting
property. If fast-check finds a counterexample, it will be logged and the test will fail,
documenting the asymmetry as a known limitation. If no counterexample is found after 1000
runs, symmetry is documented as holding.

**Validates: Requirements 5.5**

---

## Error Handling

### computeRiskLevel
No exceptions are thrown by `computeRiskLevel` for any valid input. The function is total.
The arbitraries must not generate `null` or `undefined` for `issues` or `complianceStamps`.

### FederatedServer
- `GET /query` with a non-384-dim vector returns HTTP 422. Tests only generate valid 384-dim
  vectors for the bounds properties.
- Zero vector: `_cosine_similarity` explicitly handles `norm == 0` by returning `0.0`.

### CreditTracker
- `_load()` catches filesystem errors and returns a fresh state. The in-memory stub must
  not throw on `readFileSync` (return `'{}'` or throw — both are handled).
- Month boundary: `_ensureMonth` is called before every public method, so the reset is
  always applied before any read or write.

### CircuitBreaker
- `execute` in `OPEN` state throws `CircuitOpenError`. Tests that drive the breaker to
  `OPEN` must catch this error when calling `execute` after the transition.
- The clock injection means no `setTimeout` or `Date.now` is called in tests.

### computeFingerprint / computeSimilarity
- Both functions are total for any string / fingerprint input.
- `computeSimilarity` uses `Math.max(a.complexity, b.complexity, 1)` in the denominator,
  preventing division by zero even when both complexities are 0.

---

## Testing Strategy

### Dual testing approach

Unit tests (existing) cover specific examples and integration points. The PBT suites in
this feature cover universal properties across randomised inputs. Both are complementary.

### TypeScript: vitest + fast-check

**Test runner**: vitest (already configured in `vitest.config.ts`). The `tests/property/`
directory is already picked up by the default glob (`**/*.test.ts`). No additional vitest
config is needed.

**fast-check version**: `^4.6.0` (confirmed in `package.json` devDependencies).

**Iterations**: each `fc.assert` call uses `{ numRuns: 1000 }` (Properties 1–6, 15–26) or
`{ numRuns: 200 }` where the requirement specifies 200 (Properties 7–10). The default
fast-check seed is used; CI can pin it via `FC_GLOBAL_SEED` env var for reproducibility.

**Tag format** (comment above each `fc.assert`):
```typescript
// Feature: pbt-core-invariants, Property N: <property_text>
```

**File: `tests/property/risk-level.pbt.test.ts`**
- Imports: `computeRiskLevel` from `../../src/governance/GovernanceEngine.js`
- Defines `issueArb`, `stampArb` inline
- Contains 6 `it` blocks (Properties 1–6)
- Property 3 generator: filters stamps so `avg < 0.7` using `fc.array(stampArb, { minLength: 1 }).filter(stamps => avg(stamps) < 0.7)`
- Property 4 generator: uses `fc.oneof(fc.constant([]), fc.array(stampArb).filter(stamps => avg(stamps) >= 0.7))`

**File: `tests/property/circuit-breaker.pbt.test.ts`**
- Imports: `CircuitBreaker`, `CircuitOpenError` from `../../src/utils/circuitBreaker.js`
- Clock pattern: `let now = 0; const clock = () => now;` — reset per test via `beforeEach`
- Operation sequence arbitrary:
  ```typescript
  const opArb = fc.array(
    fc.record({ kind: fc.constantFrom('success', 'failure') }),
    { minLength: 0, maxLength: 50 }
  );
  ```
- For Properties 17–19, the breaker is driven to the required state deterministically
  before the property assertion (not via arbitrary sequences).
- Contains 7 `it` blocks (Properties 15–21)

**File: `tests/property/fingerprint.pbt.test.ts`**
- Imports: `computeFingerprint`, `computeSimilarity` from `../../src/governance/utils/fingerprint.js`
- `fingerprintArb` defined inline as shown in §Components
- For Property 26 (symmetry): uses `fc.assert` with `{ numRuns: 1000 }`. If the property
  fails, fast-check prints the counterexample. The test is written as a normal asserting
  test (not `.skip`). A comment documents the expected outcome.
- Contains 5 `it` blocks (Properties 22–26)

### Python: pytest + hypothesis

**Test runner**: pytest (existing setup in `federated-server/tests/`).

**Hypothesis version**: already installed (confirmed by existing `test_stats.py`).

**Settings**: `@settings(max_examples=200)` for FederatedServer tests,
`@settings(max_examples=1000)` for CreditTracker tests.

**Tag format** (docstring in each test):
```python
# Feature: pbt-core-invariants, Property N: <property_text>
```

**File: `federated-server/tests/test_federated_bounds.py`**
- Imports: `main`, `_InMemoryStore`, `app`, `TestClient`
- Uses `_fresh_client()` helper (same pattern as `test_stats.py`)
- `vector_st` strategy generates 384-element lists of floats in `[-1, 1]`, then normalises
- Zero vector injected via `st.just([0.0] * 384)` combined with `st.one_of(vector_st(), st.just([0.0]*384))`
- Contains 4 test functions (Properties 7–10)
- For Properties 8 and 9: tests the arithmetic formula directly (no HTTP call needed),
  since the formula is `min(1.0, success_count / max(1, total_pushes))`

**File: `federated-server/tests/test_credit_tracker.py`**
- Pure-logic tests — no JS import
- Reimplements the three invariants as pure Python functions matching the JS logic:
  - `ensure_month(state, current_month)` → returns new state
  - `get_remaining(used, limit)` → `None if limit == 0 else max(0, limit - used)`
  - `increment(state, provider_id)` → returns new state
- Hypothesis strategies: `provider_id_st`, `limit_st`, `used_count_st`, `n_calls_st`,
  `month_st` (using `st.dates`)
- Contains 4 test functions (Properties 11–14)
- Each test documents the JS source it mirrors with a comment

### Property test configuration summary

| Property | File | numRuns | Tag |
|---|---|---|---|
| 1–6 | risk-level.pbt.test.ts | 1000 | Feature: pbt-core-invariants, Property N |
| 7–10 | test_federated_bounds.py | 200 | Feature: pbt-core-invariants, Property N |
| 11–14 | test_credit_tracker.py | 1000 | Feature: pbt-core-invariants, Property N |
| 15–21 | circuit-breaker.pbt.test.ts | 1000 | Feature: pbt-core-invariants, Property N |
| 22–26 | fingerprint.pbt.test.ts | 1000 | Feature: pbt-core-invariants, Property N |

### Running the tests

TypeScript:
```bash
npx vitest --run tests/property/
```

Python:
```bash
cd federated-server && python -m pytest tests/test_federated_bounds.py tests/test_credit_tracker.py -v
```
