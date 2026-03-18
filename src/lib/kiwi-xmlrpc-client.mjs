/**
 * Cliente XML-RPC para Kiwi TCMS
 * Implementa comunicação segura com certificados autoassinados e autenticação via token
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const xmlrpc = require('xmlrpc');

export interface KiwiConfig {
  baseUrl: string;
  username: string;
  password: string;
  defaultProduct: string;
  defaultPlanId: number;
  testRunTemplate: string;
  timeout?: number;
  retries?: number;
  verbose?: boolean;
}

export interface TestRunData {
  build?: number;
  manager?: number;
  plan: number;
  summary: string;
  notes?: string;
}

export interface TestExecutionData {
  assignee?: number;
  build?: number;
  case: number;
  run: number;
  status?: number;
  tested_by?: number;
  start_date?: string;
  stop_date?: string;
  comment?: string;
}

export class KiwiXmlRpcClient {
  private client: any;
  private config: KiwiConfig;
  private authToken: string | null = null;

  constructor(config: KiwiConfig) {
    this.config = config;
    
    // Parsear baseUrl
    const url = new URL(config.baseUrl);
    const useHttps = url.protocol === 'https:';
    
    const clientOptions: any = {
      host: url.hostname,
      port: useHttps ? (url.port || 443) : (url.port || 80),
      path: '/xml-rpc/',
    };
    
    if (useHttps) {
      clientOptions.rejectUnauthorized = false; // Aceitar certificado autoassinado
      this.client = xmlrpc.createSecureClient(clientOptions);
    } else {
      this.client = xmlrpc.createClient(clientOptions);
    }
  }

  /**
   * Autenticar usando Auth.login
   */
  async authenticate(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.methodCall('Auth.login', [this.config.username, this.config.password], (err: any, result: any) => {
        if (err) {
          console.error('Erro ao autenticar:', err);
          reject(err);
          return;
        }
        
        this.authToken = result;
        console.log('✓ Autenticado com sucesso');
        resolve();
      });
    });
  }

  /**
   * Wrapper para chamadas autenticadas
   */
  private authenticatedCall(methodName: string, params: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.authToken) {
        reject(new Error('Not authenticated'));
        return;
      }

      this.client.methodCall(methodName, [...params], (err: any, result: any) => {
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
  async createTestRun(data: TestRunData): Promise<number> {
    return this.authenticatedCall('TestRun.create', [data]).then((result: any) => {
      console.log('✓ TestRun criado com ID:', result.id);
      return result.id;
    });
  }

  /**
   * Adicionar um resultado de teste a um TestRun
   */
  async addTestExecution(data: TestExecutionData): Promise<number> {
    return this.authenticatedCall('TestExecution.create', [data]).then((result: any) => {
      return result.id;
    });
  }

  /**
   * Buscar TestCase pelo nome
   */
  async findTestCaseByName(name: string): Promise<any | undefined> {
    return this.authenticatedCall('TestCase.filter', [{ name }]).then((result: any[]) => {
      if (result && result.length > 0) {
        return result[0];
      }
      return undefined;
    });
  }

  /**
   * Buscar Product pelo nome
   */
  async findProductByName(name: string): Promise<any | undefined> {
    return this.authenticatedCall('Product.filter', [{ name }]).then((result: any[]) => {
      if (result && result.length > 0) {
        return result[0];
      }
      return undefined;
    });
  }

  /**
   * Listar Build do Product
   */
  async listBuilds(productId: number): Promise<any[]> {
    return this.authenticatedCall('Build.filter', [{ product: productId }]).then((result: any[]) => {
      return result || [];
    });
  }

  /**
   * Buscar TestRunStatus pelo nome
   */
  async findTestRunStatusByName(name: string): Promise<any | undefined> {
    return this.authenticatedCall('TestRunStatus.filter', [{ name }]).then((result: any[]) => {
      if (result && result.length > 0) {
        return result[0];
      }
      return undefined;
    });
  }

  /**
   * Listar todos os métodos disponíveis
   */
  async listMethods(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.client.methodCall('system.listMethods', [], (err: any, result: string[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        resolve(result || []);
      });
    });
  }
}