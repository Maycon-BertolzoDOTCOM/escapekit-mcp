const xmlrpc = require('xmlrpc');

const client = xmlrpc.createSecureClient({
  host: 'localhost',
  port: 8443,
  path: '/xml-rpc/',
  rejectUnauthorized: false,
  basic_auth: {
    user: 'admin',
    pass: 'axfwxZMnJK'
  }
});

client.methodCall('system.listMethods', [], (err, methods) => {
  if (err) {
    console.error('Erro:', err);
    return;
  }
  
  console.log(`=== ${methods.length} métodos XML-RPC disponíveis ===`);
  console.log('\n=== Métodos de Status ===');
  methods.filter(m => m.toLowerCase().includes('status')).forEach(m => console.log('  -', m));
  
  console.log('\n=== Métodos de Product ===');
  methods.filter(m => m.toLowerCase().includes('product')).forEach(m => console.log('  -', m));
  
  console.log('\n=== Métodos de TestRun ===');
  methods.filter(m => m.toLowerCase().includes('testrun')).forEach(m => console.log('  -', m));
  
  console.log('\n=== Métodos de TestCase ===');
  methods.filter(m => m.toLowerCase().includes('testcase')).forEach(m => console.log('  -', m));
});