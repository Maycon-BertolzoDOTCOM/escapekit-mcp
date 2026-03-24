# Iterative Validation Loop Implementation Tasks

- [x] Task 1: Add new fields to `src/validate/types.ts`
    - 1.1: Add optional `maxIterations?: number` to `ValidationOptions` interface
    - 1.2: Add `iterationCount: number` to `ValidationResult` interface
    - 1.3: Run type diagnostics to verify no breaking changes

- [x] Task 2: Add constants and `clampIterations` method to `ValidationEngine`
    - 2.1: Define constants `DEFAULT_MAX_ITERATIONS = 3`, `MIN_ITERATIONS_LIMIT = 1`, `MAX_ITERATIONS_LIMIT = 10`
    - 2.2: Implement `private clampIterations(value: number | undefined): number`
    - 2.3: Add unit tests for `clampIterations` method

- [x] Task 3: Replace single auto-fix block with iterative loop
    - 3.1: Initialize `iterationCount = 0` before auto-fix block
    - 3.2: Replace `if (opts.autoFix && issues.length > 0)` with `while (iterationCount < maxIter)`
    - 3.3: Implement three stop conditions:
        - No error issues remaining
        - No progress in an iteration
        - Max iterations reached
    - 3.4: Accumulate fixes across iterations
    - 3.5: Revalidate with validators after each iteration

- [x] Task 4: Add iteration logging
    - 4.1: Log `info` at start of each iteration (iteration number, error count)
    - 4.2: Log `info` at end of each iteration (fixes applied, remaining errors)
    - 4.3: Log `warn` when stopping due to no progress
    - 4.4: Log `warn` when stopping at max iterations with remaining errors

- [x] Task 5: Include `iterationCount` in returned `ValidationResult`
    - 5.1: Add `iterationCount` to result object
    - 5.2: Ensure `iterationCount === 0` when `autoFix: false`
    - 5.3: Verify all existing result consumers handle the new field

- [x] Task 6: Write unit tests for iterative loop
    - 6.1: Create `tests/validate/ValidationEngine.loop.test.ts`
    - 6.2: Mock dependencies (`AutoFixEngine`, `BuildValidator`, `DependencyValidator`)
    - 6.3: Test all stop conditions
    - 6.4: Test `clampIterations` behavior
    - 6.5: Test iteration count reporting
    - 6.6: Test fixes accumulation
    - 6.7: Test logging behavior
    - 6.8: Test backward compatibility (`autoFix: false`)

- [x] Task 7: Verify diagnostics and compatibility
    - 7.1: Run type checks on modified files
    - 7.2: Verify no breaking changes for existing consumers
    - 7.3: Fix any TypeScript errors introduced
