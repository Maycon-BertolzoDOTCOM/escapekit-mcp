#!/usr/bin/env tsx
import { KiwiIntegration } from './kiwi-tcms-integration';
import { readFileSync } from 'fs';

// Load configuration
const config = JSON.parse(
  readFileSync('./config/kiwi-tcms.json', 'utf-8')
);

// Main execution
async function main() {
  const kiwi = new KiwiIntegration(config);
  const testResults = await loadTestResults(); // Implement this based on your test runner
  
  const testRun = await kiwi.createTestRun(
    config.testRunTemplate.replace('{DATE}', new Date().toISOString()),
    config.defaultPlanId
  );

  await kiwi.importResults(testRun.id, testResults);
}

main().catch(console.error);