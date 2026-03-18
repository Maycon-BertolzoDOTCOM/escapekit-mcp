const xmlrpc = require('xmlrpc');

const client = xmlrpc.createSecureClient({
  host: 'localhost',
  port: 8443,
  path: '/xml-rpc/',
  rejectUnauthorized: false,
});

async function testAuthFlow() {
  console.log('=== Teste 1: Auth.login ===');
  try {
    const token = await new Promise((resolve, reject) => {
      client.methodCall('Auth.login', ['admin', 'axfwxZMnJK'], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    console.log('✓ Token obtido:', token);
    
    console.log('\n=== Teste 2: Product.filter (sem token) ===');
    try {
      const products = await new Promise((resolve, reject) => {
        client.methodCall('Product.filter', [{ name: 'EscapeKit' }], (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      console.log('✓ Produtos:', products);
    } catch (err) {
      console.log('✗ Erro:', err.message);
    }
    
    console.log('\n=== Teste 3: Product.filter (com token como primeiro parâmetro) ===');
    try {
      const products = await new Promise((resolve, reject) => {
        client.methodCall('Product.filter', [token, { name: 'EscapeKit' }], (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      console.log('✓ Produtos:', products);
    } catch (err) {
      console.log('✗ Erro:', err.message);
    }
    
    console.log('\n=== Teste 4: Auth.logout ===');
    try {
      await new Promise((resolve, reject) => {
        client.methodCall('Auth.logout', [], (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      console.log('✓ Logout realizado');
    } catch (err) {
      console.log('✗ Erro:', err.message);
    }
    
  } catch (err) {
    console.error('Erro fatal:', err);
  }
}

testAuthFlow();