const xmlrpc = require('xmlrpc');

// Cliente com Basic Auth
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

async function testBasicAuth() {
  console.log('=== Teste 1: Product.filter (com Basic Auth) ===');
  try {
    const products = await new Promise((resolve, reject) => {
      client.methodCall('Product.filter', [{ name: 'EscapeKit' }], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    console.log('✓ Produtos encontrados:', products.length);
    if (products.length > 0) {
      console.log('  Primeiro produto:', products[0].name, '(ID:', products[0].id + ')');
    }
  } catch (err) {
    console.log('✗ Erro:', err.message);
  }
  
  console.log('\n=== Teste 2: TestRunStatus.filter (com Basic Auth) ===');
  try {
    const statuses = await new Promise((resolve, reject) => {
      client.methodCall('TestRunStatus.filter', [{ name: 'PASSED' }], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    console.log('✓ Status encontrados:', statuses.length);
    if (statuses.length > 0) {
      console.log('  Primeiro status:', statuses[0].name, '(ID:', statuses[0].id + ')');
    }
  } catch (err) {
    console.log('✗ Erro:', err.message);
  }
}

testBasicAuth();