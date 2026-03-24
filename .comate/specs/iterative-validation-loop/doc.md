# Iterative Validation Loop Implementation

## Requirement Scenario

The current validation engine performs auto-fix in a single pass, which may not resolve all issues due to dependencies between fixes. We need to implement an iterative loop that:
1. Allows configuring maximum iterations (default: 3, min: 1, max: 10)
2. Continues fixing until either:
   - No more error issues remain
   - No progress is made in an iteration
   - Maximum iterations are reached
3. Tracks and reports iteration count
4. Maintains all existing functionality when autoFix is false

## Technical Approach

1. **Interface Updates** (`src/validate/types.ts`):
   - Add `maxIterations?: number` to `ValidationOptions`
   - Add `iterationCount: number` to `ValidationResult`

2. **Validation Engine Modifications** (`src/validate/ValidationEngine.ts`):
   - Add constants for iteration limits
   - Implement `clampIterations()` helper
   - Replace single `if (opts.autoFix)` with while loop
   - Track iteration count and fixes across iterations
   - Add proper logging for each iteration
   - Maintain backward compatibility

3. **Test Coverage** (`tests/validate/ValidationEngine.loop.test.ts`):
   - Test all stopping conditions
   - Test iteration clamping
   - Test logging behavior
   - Test backward compatibility

## Affected Files

1. `src/validate/types.ts` (modify interfaces)
2. `src/validate/ValidationEngine.ts` (core logic changes)
3. New file: `tests/validate/ValidationEngine.loop.test.ts`

## Implementation Details

### Type Changes
```typescript
// In ValidationOptions
interface ValidationOptions {
  // ... existing fields
  maxIterations?: number; // Optional max iterations (default: 3)
}

// In ValidationResult
interface ValidationResult {
  // ... existing fields
  iterationCount: number; // Number of auto-fix iterations performed
}
```

### Validation Engine Changes
```typescript
// Constants
const DEFAULT_MAX_ITERATIONS = 3;
const MIN_ITERATIONS_LIMIT = 1;
const MAX_ITERATIONS_LIMIT = 10;

private clampIterations(value: number | undefined): number {
  if (value === undefined) return DEFAULT_MAX_ITERATIONS;
  return Math.max(MIN_ITERATIONS_LIMIT, Math.min(MAX_ITERATIONS_LIMIT, value));
}

// In validate() method:
if (opts.autoFix) {
  const maxIter = this.clampIterations(opts.maxIterations);
  let iterationCount = 0;
  
  while (iterationCount < maxIter) {
    iterationCount++;
    this.log.info(`Auto-fix iteration ${iterationCount}/${maxIter}`);
    
    // Existing fix logic
    // Break conditions:
    // 1. No error issues
    // 2. No fixes applied
    // 3. iterationCount >= maxIter
  }
}
```

## Boundary Conditions

1. Handle `maxIterations` outside [1,10] range (clamp to limits)
2. Ensure `iterationCount = 0` when `autoFix: false`
3. Properly accumulate fixes across iterations
4. Maintain all existing validation behavior

## Expected Outcomes

1. Configurable iterative auto-fix with proper limits
2. Clear logging of iteration progress
3. Accurate tracking of iterations in results
4. Full backward compatibility
5. Comprehensive test coverage