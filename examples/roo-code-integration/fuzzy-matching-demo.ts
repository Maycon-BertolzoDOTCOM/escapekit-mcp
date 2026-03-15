/**
 * Fuzzy Matching Demo
 * 
 * This example demonstrates how fuzzy matching allows diffs to apply
 * even when the code has slight variations (whitespace, comments, etc.).
 */

import { DiffApplyTransformer } from '../../src/transformers/DiffApplyTransformer.js';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Example: Fuzzy matching with different code variations
 */
async function fuzzyMatchingDemo() {
  console.log('=== Fuzzy Matching Demo ===\n');

  const sampleFile = join(__dirname, 'fuzzy-sample.ts');

  // Scenario 1: Code with extra comments
  console.log('--- Scenario 1: Code with extra comments ---\n');
  
  const codeWithComments = `function greet(name: string) {
  // Say hello to the user
  console.log('Hello ' + name);
}

greet('Alice');
`;

  const diff1 = `--- a/fuzzy-sample.ts
+++ b/fuzzy-sample.ts
@@ -1,4 +1,4 @@
 function greet(name: string) {
-  console.log('Hello ' + name);
+  console.log('Hello, World!');  // Changed greeting
 }
 
 greet('Alice');
`;

  await testFuzzyMatching(sampleFile, codeWithComments, diff1, 1.0, 'Exact match (threshold 1.0)');
  await testFuzzyMatching(sampleFile, codeWithComments, diff1, 0.8, 'Fuzzy match (threshold 0.8)');

  // Scenario 2: Code with different whitespace
  console.log('\n--- Scenario 2: Code with different whitespace ---\n');

  const codeWithWhitespace = `function  greet(name:string){
console.log('Hello '+name);
}

greet('Bob');
`;

  const diff2 = `--- a/fuzzy-sample.ts
+++ b/fuzzy-sample.ts
@@ -1,3 +1,3 @@
-function  greet(name:string){
-console.log('Hello '+name);
+function  greet(name:string){
+console.log('Hello, '+name+'!');  // Added comma and exclamation
 }
 
 greet('Bob');
`;

  await testFuzzyMatching(sampleFile, codeWithWhitespace, diff2, 0.7, 'Fuzzy match for whitespace (threshold 0.7)');

  // Scenario 3: Code with minor variations
  console.log('\n--- Scenario 3: Code with minor variations ---\n');

  const codeVariation = `function greet(name: string) {
  const message = 'Hello ' + name;
  console.log(message);
}

greet('Charlie');
`;

  const diff3 = `--- a/fuzzy-sample.ts
+++ b/fuzzy-sample.ts
@@ -1,4 +1,4 @@
 function greet(name: string) {
-  const message = 'Hello ' + name;
-  console.log(message);
+  console.log('Hello, ' + name + '!');  // Simplified
 }
 
 greet('Charlie');
`;

  await testFuzzyMatching(sampleFile, codeVariation, diff3, 0.5, 'Permissive fuzzy match (threshold 0.5)');

  // Cleanup
  cleanup(sampleFile);
}

/**
 * Test fuzzy matching with a specific threshold
 */
async function testFuzzyMatching(
  filePath: string,
  code: string,
  diff: string,
  threshold: number,
  description: string
): Promise<void> {
  console.log(`Testing: ${description}`);
  console.log(`Threshold: ${threshold}`);

  // Write sample code
  writeFileSync(filePath, code, 'utf-8');

  // Initialize transformer
  const transformer = new DiffApplyTransformer();

  // Validate diff
  const isValid = transformer.validateDiff(diff);
  if (!isValid) {
    console.log('❌ Invalid diff format\n');
    return;
  }

  // Apply with fuzzy matching
  const result = await transformer.applyFuzzyDiff(filePath, diff, threshold);

  console.log(`Success: ${result.success ? 'Yes ✓' : 'No ✗'}`);
  console.log(`Hunks Applied: ${result.hunksApplied}`);
  console.log(`Hunks Failed: ${result.hunksFailed}`);

  if (result.success) {
    console.log('Modified code:');
    console.log('---');
    console.log(readFileSync(filePath, 'utf-8'));
    console.log('---');
  } else if (result.errors) {
    console.log('Errors:');
    result.errors.forEach(err => console.log(`  - ${err}`));
  }

  console.log('');
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

// Run demo
fuzzyMatchingDemo().catch(console.error);