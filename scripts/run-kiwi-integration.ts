#!/usr/bin/env tsx
import { KiwiIntegration } from './kiwi-tcms-integration';
import { loadTestResults } from './load-test-results';
import { readFileSync } from 'fs';
import { join } from 'path';

interface Config {
  baseUrl: string;
  username: string;
  password: string;
  defaultPlanId: number;
  testRunTemplate?: string;
}

function loadConfig(): Config {
  const configPath = join(process.cwd(), 'config', 'kiwi-tcms.json');
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const resolved = raw.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] || '');
    return JSON.parse(resolved);
  } catch {
    return {
      baseUrl: process.env.KIWI_URL || '',
      username: process.env.KIWI_USERNAME || '',
      password: process.env.KIWI_PASSWORD || '',
      defaultPlanId: parseInt(process.env.KIWI_TEST_PLAN_ID || '1'),
    };
  }
}

async function main() {
  const config = loadConfig();
  const kiwi = new KiwiIntegration(config);

  console.log('Connecting to Kiwi TCMS...');
  const ok = await kiwi.connect();
  if (!ok) {
    console.error('Connection failed');
    process.exit(1);
  }

  const results = await loadTestResults({
    source: process.argv[2] || 'vitest-results.json',
  });

  console.log(`Loaded ${results.length} test results`);

  const testRunName = config.testRunTemplate
    ? config.testRunTemplate.replace('{DATE}', new Date().toISOString())
    : `AutoTest-${new Date().toISOString().split('T')[0]}`;

  const testRun = await kiwi.createTestRun(testRunName, config.defaultPlanId);
  console.log(`TestRun created: ${testRun.id}`);

  await kiwi.importResults(testRun.id, results);
}

main().catch(console.error);
