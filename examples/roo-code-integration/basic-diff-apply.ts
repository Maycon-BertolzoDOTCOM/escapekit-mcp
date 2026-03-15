/**
 * Basic Diff Apply Example
 * 
 * This example demonstrates the basic usage of DiffApplyTransformer
 * to apply a unified diff to a TypeScript file.
 */

import { DiffApplyTransformer } from '../../src/transformers/DiffApplyTransformer.js';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Example: Basic diff application
 */
async function basicDiffApplyExample() {
  console.log('=== Basic Diff Apply Example ===\n');

  // Step 1: Create a sample TypeScript file
  const sampleFile = join(__dirname, 'sample.ts');
  const originalCode = `function hello(name: string) {
  console.log('Hello ' + name);
}

hello('World');
`;

  writeFileSync(sampleFile, originalCode, 'utf-8');
  console.log('✓ Created sample.ts');
  console.log('\nOriginal code:');
  console.log('---');
  console.log(originalCode);
  console.log('---\n');

  // Step 2: Define a diff to apply
  const diff = `--- a/sample.ts
+++ b/sample.ts
@@ -1,4 +1,4 @@
 function hello(name: string) {
-  console.log('Hello ' + name);
+  console.log('Hello, ' + name + '!');
 }
 
 hello('World');
`;

  console.log('Diff to apply:');
  console.log('---');
  console.log(diff);
  console.log('---\n');

  // Step 3: Initialize DiffApplyTransformer
  const transformer = new DiffApplyTransformer();
  console.log('✓ DiffApplyTransformer initialized\n');

  // Step 4: Validate the diff
  const isValid = transformer.validateDiff(diff);
  console.log(`Diff valid: ${isValid ? 'Yes ✓' : 'No ✗'}\n`);

  if (!isValid) {
    console.error('❌ Invalid diff format!');
    cleanup(sampleFile);
    return;
  }

  // Step 5: Apply the diff
  console.log('Applying diff...');
  const result = await transformer.applyDiff(sampleFile, diff, {
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

  if (result.errors && result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach(err => console.log(`  - ${err}`));
  }

  // Step 6: Show the modified code
  const modifiedCode = readFileSync(sampleFile, 'utf-8');
  console.log('\n--- Modified code ---');
  console.log(modifiedCode);
  console.log('---\n');

  // Step 7: Cleanup
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

// Run the example
basicDiffApplyExample().catch(console.error);