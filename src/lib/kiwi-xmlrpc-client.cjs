/**
 * Cliente XML-RPC para Kiwi TCMS
 * Usa Auth.login para autenticação com token
 */

const xmlrpc = require('xmlrpc');

class KiwiXmlRpcClient {
  constructor(config) {
    this.config = config;
    this.authToken = null;
    
    // Parsear baseUrl
    const url = new URL(config.baseUrl);
    const useHttps = url.protocol === 'https:';
    
    const clientOptions = {
      host: url.hostname,
      port: useHttps ? (url.port || 443) : (url.port || 80),
      path: '/xml-rpc/',
    };
    
    if (useHttps) {
      clientOptions.rejectUnauthorized = false; // Aceitar certificado autoassinado
    }
    
    if (useHttps) {
      this.client = xmlrpc.createSecureClient(clientOptions);
    } else {
      this.client = xmlrpc.createClient(clientOptions);
    }
  }
  
  /**
   * Autenticar usando Auth.login
   */
  async authenticate() {
    const result = await this.call('Auth.login', [
      this.config.username,
      this.config.password
    ]);
    this.authToken = result;
    console.log('✓ Authenticated successfully');
    return result;
  }

  /**
   * Método helper para chamadas RPC
   */
  async call(methodName, params) {
    return new Promise((resolve, reject) => {
      // Adicionar token de autenticação aos parâmetros
      const authParams = params || [];
      if (this.authToken) {
        authParams.unshift(this.authToken);
      }
      
      this.client.methodCall(methodName, authParams, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  }

  /**
   * Criar um novo TestRun
   */
  async createTestRun(data) {
    const result = await this.call('TestRun.create', [data]);
    console.log('✓ TestRun criado com ID:', result.id);
    return result.id;
  }

  /**
   * Adicionar um resultado de teste a um TestRun
   */
  async addTestExecution(data) {
    const result = await this.call('TestExecution.create', [data]);
    return result.id;
  }

  /**
   * Buscar TestCase pelo nome
   */
  async findTestCaseByName(name) {
    const result = await this.call('TestCase.filter', [{ name }]);
    if (result && result.length > 0) {
      return result[0];
    }
    return undefined;
  }

  /**
   * Buscar Product pelo nome
   */
  async findProductByName(name) {
    const result = await this.call('Product.filter', [{ name }]);
    if (result && result.length > 0) {
      return result[0];
    }
    return undefined;
  }

  /**
   * Listar Build do Product
   */
  async listBuilds(productId) {
    const result = await this.call('Build.filter', [{ product: productId }]);
    return result || [];
  }

  /**
   * Buscar TestExecutionStatus pelo nome
   */
  async findTestExecutionStatusByName(name) {
    const result = await this.call('TestExecutionStatus.filter', [{ name }]);
    if (result && result.length > 0) {
      return result[0];
    }
    return undefined;
  }

  /**
   * Criar Build
   */
  async createBuild(data) {
    return await this.call('Build.create', [data]);
  }

  /**
   * Criar TestCase
   */
  async createTestCase(data) {
    return await this.call('TestCase.create', [data]);
  }

  /**
   * Listar produtos
   */
  async listProducts() {
    return await this.call('Product.filter', [{}]);
  }
}

module.exports = { KiwiXmlRpcClient };