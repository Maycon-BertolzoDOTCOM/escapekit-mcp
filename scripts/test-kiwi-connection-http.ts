#!/usr/bin/env tsx

import { KiwiXmlRpcClient, KiwiConfig } from '../src/lib/kiwi-xmlrpc-http-client.ts';

async function testConnection() {
  console.log('Testing Kiwi TCMS XML-RPC connection (HTTP client)...\n');

  const config: KiwiConfig = {
    baseUrl: process.env.KIWI_URL || 'https://localhost:8443',
    username: process.env.KIWI_USERNAME || 'admin',
    password: process.env.KIWI_PASSWORD || 'axfwxZMnJK',
    timeout: 30000,
    retries: 3,
  };

  const client = new KiwiXmlRpcClient(config);

  try {
    // Test 1: Basic connection
    console.log('Test 1: Testing basic connection...');
    const connected = await client.testConnection();
    console.log(`Connection ${connected ? 'successful' : 'failed'}\n`);

    if (!connected) {
      process.exit(1);
    }

    // Test 2: List products
    console.log('Test 2: Listing products...');
    const products = await client.listProducts();
    console.log(`Found ${products.length} products:`);
    products.forEach((p: any) => {
      console.log(`  - ${p.name} (ID: ${p.id})`);
    });

    console.log('\n✅ All tests passed!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

testConnection();
