
import { KiwiClient } from '../src/lib/kiwi-client';

async function debug() {
  const client = new KiwiClient({
    baseUrl: 'https://paulita-unbreathed-blair.ngrok-free.dev',
    username: 'admin',
    password: 'axfwxZMnJK'
  });

  await client.authenticate();

  // Kiwi TCMS doesn't always have a list_methods but we can try to find documentation
  // or use TestPlan.filter and see its fields.
  
  // Try calling TestPlan.add_build with different names
  const methods = ['TestPlan.add_build', 'TestPlan.add_builds', 'TestPlan.associate_build'];
  for (const method of methods) {
    try {
      console.log('Testing method:', method);
      await client.jsonrpc(method, [1, 5]); // Try adding build 5 to plan 1
      console.log('SUCCESS with:', method);
      break;
    } catch (e: any) {
      console.log('FAILED with:', method, e.message);
    }
  }
}

debug();
