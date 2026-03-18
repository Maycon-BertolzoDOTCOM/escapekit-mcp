const { KiwiXmlRpcClient } = require('../src/lib/kiwi-xmlrpc-client.cjs');

const config = {
  baseUrl: 'http://localhost:8080',
  username: 'admin',
  password: 'axfwxZMnJK'
};

async function test() {
  console.log('=== Testando HTTP (não HTTPS) ===');
  const client = new KiwiXmlRpcClient(config);
  
  try {
    console.log('\n1. Listar produtos...');
    const products = await client.listProducts();
    console.log('✓ Produtos encontrados:', products.length);
    if (products.length > 0) {
      console.log('  Primeiro produto:', products[0].name, '(ID:', products[0].id + ')');
    }
    
    console.log('\n2. Buscar produto "EscapeKit"...');
    const product = await client.findProductByName('EscapeKit');
    console.log('✓ Produto encontrado:', product ? product.name : 'Nenhum');
    
    console.log('\n3. Listar status de execução...');
    const statusList = await client.call('TestExecutionStatus.filter', [{}]);
    console.log('✓ Status encontrados:', statusList.length);
    const passed = await client.findTestExecutionStatusByName('PASSED');
    console.log('  Status PASSED ID:', passed ? passed.id : 'Nenhum');
    
  } catch (err) {
    console.error('✗ Erro:', err.message);
  }
}

test();