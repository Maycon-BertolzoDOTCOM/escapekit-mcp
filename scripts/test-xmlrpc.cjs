const xmlrpc = require('xmlrpc');

// Criar cliente XML-RPC seguro (HTTPS)
const client = xmlrpc.createSecureClient({
  host: 'localhost',
  port: 8443,
  path: '/xml-rpc/',
  rejectUnauthorized: false, // Aceitar certificado autoassinado
  basic_auth: {
    user: 'admin',
    pass: 'axfwxZMnJK'
  }
});

// Método para listar todos os métodos disponíveis
console.log('Tentando listar métodos XML-RPC...');
client.methodCall('system.listMethods', [], (err, value) => {
  if (err) {
    console.error('Erro ao listar métodos:', err);
    if (err.faultCode) {
      console.error('Fault code:', err.faultCode);
      console.error('Fault string:', err.faultString);
    }
    process.exit(1);
  }
  
  console.log('\n=== Métodos disponíveis (primeiros 30) ===');
  const methods = value;
  methods.slice(0, 30).forEach((method) => {
    console.log(`  - ${method}`);
  });
  console.log(`\nTotal: ${methods.length} métodos`);
  
  // Tentar obter ajuda do método TestRun.create
  console.log('\n=== Tentando obter ajuda de TestRun.create ===');
  client.methodCall('system.methodHelp', ['TestRun.create'], (err, help) => {
    if (err) {
      console.error('Erro ao obter ajuda:', err);
    } else {
      console.log('TestRun.create help:', help);
    }
    
    // Tentar obter assinatura do método TestRun.create
    console.log('\n=== Tentando obter assinatura de TestRun.create ===');
    client.methodCall('system.methodSignature', ['TestRun.create'], (err, signature) => {
      if (err) {
        console.error('Erro ao obter assinatura:', err);
      } else {
        console.log('TestRun.create signature:', signature);
      }
      
      // Tentar obter ajuda do método TestExecution.create
      console.log('\n=== Tentando obter ajuda de TestExecution.create ===');
      client.methodCall('system.methodHelp', ['TestExecution.create'], (err, help) => {
        if (err) {
          console.error('Erro ao obter ajuda:', err);
        } else {
          console.log('TestExecution.create help:', help);
        }
        
        console.log('\n✓ Teste concluído');
      });
    });
  });
});