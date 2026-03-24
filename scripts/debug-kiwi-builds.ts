
import { KiwiClient } from '../src/lib/kiwi-client';
async function debug() {
  const client = new KiwiClient({
    baseUrl: 'https://paulita-unbreathed-blair.ngrok-free.dev',
    username: 'admin',
    password: 'axfwxZMnJK'
  });

  await client.authenticate();

  const productId = 1;
  const buildName = `Auto-${new Date().toISOString().split('T')[0]}`;
  
  console.log('Searching with version__product filter:', productId);
  const buildsWithFilter = await client.jsonrpc('Build.filter', [{ version__product: productId }]);
  console.log('Found with filter:', (buildsWithFilter as any[]).length);
  const foundWithFilter = (buildsWithFilter as any[]).find(b => b.name === buildName);
  console.log('Found build with name "' + buildName + '" in filtered list:', !!foundWithFilter);

  console.log('\nSearching ALL builds:');
  const allBuilds = await client.jsonrpc('Build.filter', [{}]);
  console.log('Total builds:', (allBuilds as any[]).length);
  const foundInAll = (allBuilds as any[]).find(b => b.name === buildName);
  console.log('Found build with name "' + buildName + '" in ALL list:', !!foundInAll);
  if (foundInAll) {
    console.log('Build details:', JSON.stringify(foundInAll, null, 2));
  }
}

debug();
