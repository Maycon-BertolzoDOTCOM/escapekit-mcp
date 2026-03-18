import { KiwiXmlRpcClient, KiwiConfig } from '../src/lib/kiwi-xmlrpc-http-client.ts';

const config: KiwiConfig = {
  baseUrl: 'https://localhost:8443',
  username: 'admin',
  password: 'axfwxZMnJK',
  defaultProduct: 'EscapeKit',
  defaultPlanId: 1,
  testRunTemplate: 'AutoTest-{DATE}',
  timeout: 5000,
  retries: 3,
};

async function main() {
  console.log('Starting simple upload test...');
  
  const client = new KiwiXmlRpcClient(config);
  
  // Get product
  const product = await client.findProductByName('EscapeKit');
  console.log('Product:', product);
  
  // Get builds
  const builds = await client.listBuilds(product.id);
  console.log('Builds:', builds.length);
  
  // Get current user
  const user = await client.getCurrentUser();
  console.log('Current user:', user);
  
  // Create TestRun
  const testRun = await client.createTestRun({
    build: builds[0].id,
    plan: 1,
    summary: 'Simple Test',
    manager: user.id,
  });
  console.log('TestRun created:', testRun);
  
  // Find test case
  const testCase = await client.findTestCaseByName('Sample Test Case');
  if (testCase) {
    console.log('Found test case:', testCase.id);
    
    // Add test execution
    const execution = await client.addTestExecution({
      case: testCase.id,
      run: testRun.id,
      status: 4, // PASSED
      comment: 'Test via simple script',
    });
    console.log('Test execution added:', execution);
  }
  
  console.log('Test complete!');
}

main().catch(console.error);