#!/usr/bin/env tsx

import { KiwiXmlRpcClient, KiwiConfig } from '../src/lib/kiwi-xmlrpc-client.ts';

async function testConnection() {
  console.log('Testing Kiwi TCMS XML-RPC connection...\n');

  const config: KiwiConfig = {
    baseUrl: process.env.KIWI_URL || 'https://localhost:8443',
    username: process.env.KIWI_USERNAME || 'admin',
    password: process.env.KIWI_PASSWORD || 'axfwxZMnJK',
    timeout: 5000,
    retries: 3,
  };

  console.log('Configuration:');
  console.log(`  URL: ${config.baseUrl}`);
  console.log(`  Username: ${config.username}`);
  console.log(`  Password: ***\n`);

  const client = new KiwiXmlRpcClient(config);

  try {
    // Test 1: Basic connection
    console.log('Test 1: Testing basic connection...');
    const connected = await client.testConnection();
    console.log(`✓ Connection ${connected ? 'successful' : 'failed'}\n`);

    if (!connected) {
      process.exit(1);
    }

    // Test 2: List products
    console.log('Test 2: Listing products...');
    const products = await client.listProducts();
    console.log(`✓ Found ${products.length} products:`);
    products.forEach((p: any) => {
      console.log(`  - ${p.name} (ID: ${p.id})`);
    });
    console.log('');

    // Test 3: Find product by name
    console.log('Test 3: Finding product "EscapeKit"...');
    const product = await client.findProductByName('EscapeKit');
    if (product) {
      console.log(`✓ Found product: ${product.name} (ID: ${product.id})\n`);
    } else {
      console.log('✗ Product not found\n');
    }

    // Test 4: List builds
    if (product) {
      console.log(`Test 4: Listing builds for product "${product.name}"...`);
      const builds = await client.listBuilds(product.id);
      console.log(`✓ Found ${builds.length} builds:`);
      builds.forEach((b: any) => {
        console.log(`  - ${b.name} (ID: ${b.id})`);
      });
      console.log('');
    }

    console.log('✅ All tests passed!');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testConnection();