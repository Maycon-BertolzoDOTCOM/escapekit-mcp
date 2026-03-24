import { KiwiClient } from '../src/lib/kiwi-client';
import { KiwiClient } from '../src/lib/kiwi-client';
import { KiwiClientConfig } from '../src/lib/kiwi-client';

function loadConfig(): KiwiClientConfig {
  const baseUrl = process.env.KIWI_URL || '';
  const username = process.env.KIWI_USERNAME || '';
  const password = process.env.KIWI_PASSWORD || '';
  
  console.log('Using configuration:', { 
    baseUrl: baseUrl ? '***' : 'MISSING', 
    username: username ? '***' : 'MISSING',
    password: password ? '***' : 'MISSING'
  });
  
  if (!baseUrl || !username || !password) {
    throw new Error('Missing required environment variables: KIWI_URL, KIWI_USERNAME, KIWI_PASSWORD');
  }
  
  return {
    baseUrl,
    username,
    password,
    timeout: 15000,
    retries: 3
  };
}

async function main() {
  const config = loadConfig();
  const client = new KiwiClient(config);
  
  await client.authenticate();
  
  const productId = parseInt(process.env.KIWI_PRODUCT_ID || '1');
  const testPlanId = parseInt(process.env.KIWI_TEST_PLAN_ID || '1');
  
  // List builds for product
  const builds = await client.listBuilds(productId);
  console.log('Available builds:');
  builds.forEach(b => console.log(`- ${b.name} (ID: ${b.id})`));
  
  // Check plan builds (via API)
  try {
    const planBuilds = await client.jsonrpc('TestPlan.filter', [{ id: testPlanId }]);
    console.log('\nBuilds associated with plan:', planBuilds[0]?.builds || []);
  } catch (error) {
    console.warn('\nCould not fetch plan builds:', error.message);
  }
}

main().catch(console.error);