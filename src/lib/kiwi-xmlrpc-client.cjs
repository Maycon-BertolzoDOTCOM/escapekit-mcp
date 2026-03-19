/**
 * Cliente XML-RPC para Kiwi TCMS
 * Usa autenticação por cookie de sessão Django
 */

const xmlrpc = require('xmlrpc');
const http = require('http');
const https = require('https');

class KiwiXmlRpcClient {
  constructor(config) {
    this.config = config;
    this.sessionCookie = null;

    // Parsear baseUrl
    const url = new URL(config.baseUrl);
    this.useHttps = url.protocol === 'https:';
    this.host = url.hostname;
    this.port = url.port || (this.useHttps ? 443 : 80);
    this.path = '/xml-rpc/';

    // Criar cliente HTTP com suporte a cookies
    const clientOptions = {
      host: this.host,
      port: this.port,
      path: this.path,
    };

    if (this.useHttps) {
      clientOptions.rejectUnauthorized = false;
      // Criar agente HTTPS - forçar IP específico se necessário
      this.httpsAgent = new https.Agent({
        rejectUnauthorized: false,
        family: 4, // Force IPv4
      });
      this.httpClient = https;
    } else {
      this.httpClient = http;
    }

    console.log(
      '🔍 DEBUG KiwiXmlRpcClient: Created with host:',
      this.host,
      'port:',
      this.port,
      'https:',
      this.useHttps
    );
  }

  /**
   * Fazer chamada XML-RPC usando HTTP nativo (para manter cookies)
   */
  async xmlRpcCall(methodName, params) {
    return new Promise((resolve, reject) => {
      const xmlBody = this.buildXmlRpcRequest(methodName, params);

      const options = {
        hostname: this.host,
        port: this.port,
        path: this.path,
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'Content-Length': Buffer.byteLength(xmlBody),
        },
      };

      if (this.useHttps) {
        options.agent = this.httpsAgent;
      }

      if (this.sessionCookie) {
        options.headers['Cookie'] = this.sessionCookie;
      }

      const req = this.httpClient.request(options, res => {
        // Capturar cookie de sessão
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          this.sessionCookie = setCookie.map(c => c.split(';')[0]).join('; ');
        }

        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          console.log('🔍 DEBUG xmlRpcCall: response length:', data.length);
          console.log('🔍 DEBUG xmlRpcCall: response status:', res.statusCode);
          console.log('🔍 DEBUG xmlRpcCall: raw response:', data.substring(0, 1000));
          const result = this.parseXmlRpcResponse(data);
          if (result.error) {
            console.error(`🔴 XML-RPC Error in ${methodName}:`, result.error);
            reject(new Error(result.error));
          } else {
            console.log(
              `🟢 XML-RPC Success in ${methodName}:`,
              JSON.stringify(result.data).substring(0, 500)
            );
            resolve(result.data);
          }
        });
      });

      req.on('error', reject);
      req.write(xmlBody);
      req.end();
    });
  }

  /**
   * Construir request XML-RPC
   */
  buildXmlRpcRequest(methodName, params) {
    let paramsXml = '';
    for (const param of params) {
      paramsXml += `<param>${this.xmlValue(param)}</param>`;
    }
    return `<?xml version="1.0"?>
<methodCall>
  <methodName>${methodName}</methodName>
  <params>${paramsXml}</params>
</methodCall>`;
  }

  /**
   * Converter valor JavaScript para XML-RPC
   */
  xmlValue(value) {
    if (value === null || value === undefined) {
      return '<value><nil/></value>';
    }
    if (typeof value === 'string') {
      return `<value><string>${this.escapeXml(value)}</string></value>`;
    }
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return `<value><int>${value}</int></value>`;
      }
      return `<value><double>${value}</double></value>`;
    }
    if (typeof value === 'boolean') {
      return `<value><boolean>${value ? 1 : 0}</boolean></value>`;
    }
    if (Array.isArray(value)) {
      const items = value.map(v => `<value>${this.xmlValue(v)}</value>`).join('');
      return `<value><array><data>${items}</data></array></value>`;
    }
    if (typeof value === 'object') {
      let members = '';
      for (const [key, val] of Object.entries(value)) {
        members += `<member><name>${key}</name>${this.xmlValue(val)}</member>`;
      }
      return `<value><struct>${members}</struct></value>`;
    }
    return `<value><string>${String(value)}</string></value>`;
  }

  /**
   * Escapar XML
   */
  escapeXml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Parsar resposta XML-RPC
   */
  parseXmlRpcResponse(xml) {
    // Verificar se há fault
    if (xml.includes('<fault>')) {
      const faultStringMatch = xml.match(/<faultString>([\s\S]*?)<\/faultString>/);
      const faultCodeMatch = xml.match(/<faultCode>(\d+)<\/faultCode>/);
      const code = faultCodeMatch ? faultCodeMatch[1] : '-32603';
      let msg = 'Unknown error';

      if (faultStringMatch) {
        // Extrair conteúdo da faultString
        const stringMatch = faultStringMatch[1].match(/<string>([\s\S]*?)<\/string>/);
        msg = stringMatch ? stringMatch[1] : faultStringMatch[1];
      }

      console.error('🔴 DEBUG parseXmlRpcResponse: FAULT detected!');
      console.error('  - faultCode:', code);
      console.error('  - faultString:', msg);
      console.error('  - full xml sample:', xml.substring(0, 500));
      return { error: `XML-RPC fault ${code}: ${msg}` };
    }

    const paramsMatch = xml.match(/<params>([\s\S]*?)<\/params>/);
    if (paramsMatch) {
      // Extrair primeiro parâmetro (geralmente o resultado)
      const paramMatch = paramsMatch[1].match(/<param>([\s\S]*?)<\/param>/);
      if (paramMatch) {
        return { data: this.parseXmlValue(paramMatch[1]) };
      }
    }

    return { data: null };
  }

  /**
   * Parsar valor XML
   */
  parseXmlValue(xml) {
    // Verificar struct primeiro (pois contém outros valores)
    const structMatch = xml.match(/<struct>([\s\S]*?)<\/struct>/);
    if (structMatch) {
      const result = {};
      const members = structMatch[1].match(/<member>[\s\S]*?<\/member>/g);
      if (members) {
        for (const member of members) {
          const nameMatch = member.match(/<name>(.*?)<\/name>/);
          const valueMatch = member.match(/<value>([\s\S]*?)<\/value>/);
          if (nameMatch && valueMatch) {
            result[nameMatch[1]] = this.parseXmlValue(valueMatch[1]);
          }
        }
      }
      return result;
    }

    // Verificar array
    const arrayMatch = xml.match(/<array>([\s\S]*?)<\/array>/);
    if (arrayMatch) {
      const dataMatch = arrayMatch[1].match(/<data>([\s\S]*?)<\/data>/);
      if (dataMatch) {
        const content = dataMatch[1];
        // Extrair cada <value>...</value>
        const values = [];
        let remaining = content;
        while (remaining.includes('<value>')) {
          const valueMatch = remaining.match(/<value>([\s\S]*?)<\/value>/);
          if (valueMatch) {
            values.push(this.parseXmlValue(valueMatch[1]));
            remaining = remaining.substring(valueMatch[0].length);
          } else {
            break;
          }
        }
        return values;
      }
      return [];
    }

    const stringMatch = xml.match(/<string>(.*?)<\/string>/s);
    if (stringMatch) return stringMatch[1];

    const intMatch = xml.match(/<int>(-?\d+)<\/int>/);
    if (intMatch) return parseInt(intMatch[1], 10);

    const doubleMatch = xml.match(/<double>(-?[\d.]+)<\/double>/);
    if (doubleMatch) return parseFloat(doubleMatch[1]);

    const booleanMatch = xml.match(/<boolean>([01])<\/boolean>/);
    if (booleanMatch) return booleanMatch[1] === '1';

    return xml;
  }

  /**
   * Autenticar usando Auth.login
   */
  async authenticate() {
    console.log('🔍 DEBUG authenticate: Calling Auth.login...');
    console.log('🔍 DEBUG authenticate: username:', this.config.username);
    console.log('🔍 DEBUG authenticate: baseUrl:', this.config.baseUrl);
    try {
      const result = await this.xmlRpcCall('Auth.login', [
        this.config.username,
        this.config.password,
      ]);
      console.log('🔍 DEBUG authenticate: Auth.login returned:', result);
      console.log('🔍 DEBUG authenticate: Session cookie:', this.sessionCookie);
      console.log('✓ Authenticated successfully');
      return result;
    } catch (err) {
      console.error('🔴 Authentication failed:', err.message);
      throw err;
    }
  }

  /**
   * Chamada RPC (usa cookie de sessão)
   */
  async call(methodName, params) {
    console.log(
      `🔍 DEBUG call: ${methodName} with params:`,
      JSON.stringify(params || []).substring(0, 500)
    );
    try {
      const result = await this.xmlRpcCall(methodName, params || []);
      return result;
    } catch (err) {
      console.error(`🔴 call(${methodName}) failed:`, err.message);
      throw err;
    }
  }

  /**
   * Chamada sem autenticação (para Auth.login)
   */
  async callNoAuth(methodName, params) {
    return await this.call(methodName, params);
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
    console.log('🔍 DEBUG addTestExecution: data:', JSON.stringify(data));
    const result = await this.call('TestExecution.create', [data]);
    return result.id;
  }

  /**
   * Buscar TestCase pelo nome
   */
  async findTestCaseByName(name) {
    const result = await this.call('TestCase.filter', [{ summary: name }]);
    // Garantir que result é um array
    const results = Array.isArray(result) ? result : result ? [result] : [];
    if (results && results.length > 0) {
      return results[0];
    }
    return undefined;
  }

  /**
   * Buscar Product pelo nome
   */
  async findProductByName(name) {
    const result = await this.call('Product.filter', [{ name }]);
    // Garantir que result é um array
    const results = Array.isArray(result) ? result : result ? [result] : [];
    if (results && results.length > 0) {
      return results[0];
    }
    return undefined;
  }

  /**
   * Listar Build do Product
   */
  async listBuilds(productId) {
    const result = await this.call('Build.filter', [{ version: productId }]);
    // Garantir que retornamos um array
    return Array.isArray(result) ? result : result ? [result] : [];
  }

  /**
   * Buscar TestExecutionStatus pelo nome
   */
  async findTestExecutionStatusByName(name) {
    const result = await this.call('TestExecutionStatus.filter', [{ name }]);
    // Garantir que result é um array
    const results = Array.isArray(result) ? result : result ? [result] : [];
    if (results && results.length > 0) {
      return results[0];
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
    console.log('🔍 DEBUG listProducts: Calling Product.filter...');
    const result = await this.call('Product.filter', [{}]);
    console.log('🔍 DEBUG listProducts: raw result:', result);
    // Garantir que retornamos um array
    const products = Array.isArray(result) ? result : result ? [result] : [];
    console.log('🔍 DEBUG listProducts: Got', products.length, 'products');
    return products;
  }
}

module.exports = { KiwiXmlRpcClient };
