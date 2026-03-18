const xmlrpc = require('xmlrpc');
const https = require('https');

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
client.methodCall('system.listMethods', [], (err: any, value: any) => {
  if (err) {
    console.error('Erro ao listar métodos:', err);
    if (err.faultCode) {
      console.error('Fault code:', err.faultCode);
      console.error('Fault string:', err.faultString);
    }
    process.exit(1);
  }
  
  console.log('\n=== Métodos disponíveis (primeiros 30) ===');
  const methods = value as string[];
  methods.slice(0, 30).forEach((method: string) => {
    console.log(`  - ${method}`);
  });
  console.log(`\nTotal: ${methods.length} métodos`);
  
  // Tentar obter ajuda do método TestRun.create
  console.log('\n=== Tentando obter ajuda de TestRun.create ===');
  client.methodCall('system.methodHelp', ['TestRun.create'], (err: any, help: any) => {
    if (err) {
      console.error('Erro ao obter ajuda:', err);
    } else {
      console.log('TestRun.create help:', help);
    }
    
    // Tentar obter assinatura do método TestRun.create
    console.log('\n=== Tentando obter assinatura de TestRun.create ===');
    client.methodCall('system.methodSignature', ['TestRun.create'], (err: any, signature: any) => {
      if (err) {
        console.error('Erro ao obter assinatura:', err);
      } else {
        console.log('TestRun.create signature:', signature);
      }
      
      // Tentar obter ajuda do método TestExecution.create
      console.log('\n=== Tentando obter ajuda de TestExecution.create ===');
      client.methodCall('system.methodHelp', ['TestExecution.create'], (err: any, help: any) => {
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