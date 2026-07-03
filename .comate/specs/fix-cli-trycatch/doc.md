# Fix CLI Validation Try-Catch Blocks

## Requirement Scenario

The CLI validation flow in `src/cli/index.ts` has nested try-catch blocks (lines 343-497) that need to be restructured for:
1. Better error handling
2. Proper spinner cleanup
3. Consistent error reporting

## Technical Approach

1. Flatten the nested try-catch structure
2. Ensure spinner is always stopped on errors
3. Maintain consistent error reporting format
4. Preserve all existing functionality

## Affected Files

- `src/cli/index.ts` (modify validation command implementation)

## Implementation Details

Key changes needed:

```typescript
// Current structure (problematic):
try {
  // Outer try
  const spinner = new Spinner();
  try {
    // Inner try
    // Validation logic
  } catch (error) {
    // Inner catch
    spinner.stop();
    throw error;
  }
} catch (error) {
  // Outer catch
  console.error(error);
}

// Proposed structure:
const spinner = new Spinner();
try {
  // Single try block
  // Validation logic
} catch (error) {
  // Single catch block
  spinner.stop();
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  // Ensure spinner is always stopped
  spinner.stop();
}
```

## Boundary Conditions

- Must handle:
  - Validation errors
  - Spinner cleanup
  - Stdout restoration
  - Process exit codes

## Expected Outcomes

- Single, flattened try-catch structure
- Guaranteed spinner cleanup
- Consistent error reporting
- No functionality changes

## Data Flow

1. Command invoked
2. Spinner created
3. Validation runs
4. On success:
   - Results displayed
   - Spinner stopped
5. On error:
   - Error reported
   - Spinner stopped
   - Process exits with code 1