/**
 * Multi-Hunk Diff Example
 * 
 * This example demonstrates applying diffs with multiple hunks
 * (multiple change blocks) in a single diff file.
 */

import { DiffApplyTransformer } from '../../src/transformers/DiffApplyTransformer.js';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Example: Multi-hunk diff application
 */
async function multiHunkExample() {
  console.log('=== Multi-Hunk Diff Example ===\n');

  const sampleFile = join(__dirname, 'multi-hunk-sample.ts');

  // Step1: Create a sample file with multiple functions
  const originalCode = `function calculateSum(a: number, b: number): number {
  return a + b;
}

function calculateDifference(a: number, b: number): number {
  return a - b;
}

function calculateProduct(a: number, b: number): number {
  return a * b;
}

function calculateQuotient(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

// Test the functions
console.log(calculateSum(5, 3));
console.log(calculateDifference(10, 4));
console.log(calculateProduct(6, 7));
console.log(calculateQuotient(20, 4));
`;

  writeFileSync(sampleFile, originalCode, 'utf-8');
  console.log('✓ Created multi-hunk-sample.ts');
  console.log('\nOriginal code:');
  console.log('---');
  console.log(originalCode);
  console.log('---\n');

  // Step2: Define a multi-hunk diff
  // This diff modifies 3 different functions in separate hunks
  const multiHunkDiff = `--- a/multi-hunk-sample.ts
+++ b/multi-hunk-sample.ts
@@ -1,21 +1,21 @@
 function calculateSum(a: number, b: number): number {
-  return a + b;
+  return a + b;  // Addition: a + b
 }
 
 function calculateDifference(a: number, b: number): number {
-  return a - b;
+  return a - b;  // Difference: a - b
 }
 
-function calculateProduct(a: number, b: number): number {
-  return a * b;
+function calculateSquare(a: number): number {
+  return a * a;  // Renamed to calculateSquare
 }
 
 function calculateQuotient(a: number, b: number): number {
@@ -13,8 +13,8 @@
 }
 
 // Test the functions
-console.log(calculateSum(5, 3));
-console.log(calculateDifference(10, 4));
-console.log(calculateProduct(6, 7));
-console.log(calculateQuotient(20, 4));
+console.log('Sum:', calculateSum(5, 3));
+console.log('Difference:', calculateDifference(10, 4));
+console.log('Square:', calculateSquare(6));
+console.log('Quotient:', calculateQuotient(20, 4));
`;

  console.log('Multi-hunk diff:');
  console.log('---');
  console.log(multiHunkDiff);
  console.log('---\n');

  // Step3: Initialize DiffApplyTransformer
  const transformer = new DiffApplyTransformer();
  console.log('✓ DiffApplyTransformer initialized\n');

  // Step4: Validate diff
  const isValid = transformer.validateDiff(multiHunkDiff);
  console.log(`Diff valid: ${isValid ? 'Yes ✓' : 'No ✗'}\n`);

  if (!isValid) {
    console.error('❌ Invalid diff format!');
    cleanup(sampleFile);
    return;
  }

  // Step5: Apply multi-hunk diff
  console.log('Applying multi-hunk diff...');
  const result = await transformer.applyDiff(sampleFile, multiHunkDiff, {
    fuzzyThreshold: 1.0,  // Exact match only
    backup: true
  });

  console.log('\n--- Results ---');
  console.log(`Success: ${result.success ? 'Yes ✓' : 'No ✗'}`);
  console.log(`Hunks Applied: ${result.hunksApplied}`);
  console.log(`Hunks Failed: ${result.hunksFailed}`);
  console.log(`Lines Changed: ${result.linesChanged}`);
  
  if (result.backupPath) {
    console.log(`Backup: ${result.backupPath}`);
  }

  // Analyze hunk application
  console.log('\n--- Hunk Analysis ---');
  console.log('Total hunks in diff: 3');
  console.log('Hunks successfully applied:', result.hunksApplied);
  console.log('Hunks that failed:', result.hunksFailed);

  if (result.hunksApplied === 3) {
    console.log('✓ All hunks applied successfully!');
  } else {
    console.log('⚠️  Some hunks failed to apply');
  }

  if (result.errors && result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach((err, index) => {
      console.log(`  ${index + 1}. ${err}`);
    });
  }

  // Step6: Show modified code
  const modifiedCode = readFileSync(sampleFile, 'utf-8');
  console.log('\n--- Modified code ---');
  console.log(modifiedCode);
  console.log('---\n');

  // Step7: Highlight changes
  console.log('--- Changes Summary ---');
  console.log('1. Added comments to calculateSum()');
  console.log('2. Added comments to calculateDifference()');
  console.log('3. Renamed calculateProduct() to calculateSquare()');
  console.log('4. Updated function calls with labels\n');

  // Step8: Cleanup
  cleanup(sampleFile);
}

/**
 * Helper function to clean up temporary files
 */
function cleanup(filePath: string) {
  try {
    unlinkSync(filePath);
    const backupPath = filePath + '.backup';
    unlinkSync(backupPath);
    console.log('✓ Cleanup completed\n');
  } catch (error) {
    // Ignore errors during cleanup
  }
}

// Run example
multiHunkExample().catch(console.error);