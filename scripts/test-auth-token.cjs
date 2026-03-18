const xmlrpc = require('xmlrpc');

// Primeiro, fazer login para pegar o token
const client = xmlrpc.createSecureClient({
  host: 'localhost',
  port: 8443,
  path: '/xml-rpc/',
  rejectUnauthorized: false
});

client.methodCall('Auth.login', ['admin', 'axfwxZMnJK'], (err, token) => {
  if (err) {
    console.error('✗ Auth.login falhou:', err);
    return;
  }
  
  console.log('✓ Token recebido:', token);
  
  // Agora tentar usar o token nas chamadas subsequentes
  const clientWithToken = xmlrpc.createSecureClient({
    host: 'localhost',
    port: 8443,
    path: '/xml-rpc/',
    rejectUnauthorized: false,
    headers: {
      'Authorization': 'Bearer ' + token
    }
  });
  
  clientWithToken.methodCall('Product.filter', [{ name: 'EscapeKit' }], (err, products) => {
    if (err) {
      console.error('✗ Product.filter falhou:', err);
      return;
    }
    
    console.log('✓ Produtos encontrados:', products);
  });
});