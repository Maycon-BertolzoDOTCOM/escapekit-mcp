const xmlrpc = require('xmlrpc');

// Teste com autenticação HTTP Basic
const client = xmlrpc.createSecureClient({
  host: 'localhost',
  port: 8443,
  path: '/xml-rpc/',
  rejectUnauthorized: false,
  headers: {
    'Authorization': 'Basic ' + Buffer.from('admin:axfwxZMnJK').toString('base64')
  }
});

console.log('Testando autenticação XML-RPC...');
client.methodCall('Auth.login', ['admin', 'axfwxZMnJK'], (err, result) => {
  if (err) {
    console.error('Erro Auth.login:', err);
    return;
  }
  
  console.log('✓ Auth.login bem-sucedido!');
  console.log('Resultado:', result);
});