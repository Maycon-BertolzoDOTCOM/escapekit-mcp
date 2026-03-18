#!/usr/bin/env tsx
import axios from 'axios';
import { readFileSync, writeFileSync } from 'fs';

interface KiwiTCMSAuth {
  token: string;
}

interface Product {
  id: number;
  name: string;
}

interface TestPlan {
  id: number;
  name: string;
  product: number;
}

class KiwiTCMSAutoSetup {
  private baseUrl: string;
  private username: string;
  private password: string;
  private authToken: string | null = null;

  constructor(baseUrl: string, username: string, password: string) {
    this.baseUrl = baseUrl;
    this.username = username;
    this.password = password;
  }

  async authenticate(): Promise<void> {
    console.log('🔐 Autenticando no Kiwi TCMS...');
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/auth/login/`,
        {
          username: this.username,
          password: this.password,
        },
        { 
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
          },
          httpsAgent: undefined // Allow self-signed certs
        }
      );
      
      this.authToken = response.data.token;
      console.log('✅ Autenticação bem-sucedida');
    } catch (error: any) {
      console.error('❌ Falha na autenticação:', error.message);
      if (error.response?.data) {
        console.error('Detalhes:', error.response.data);
      }
      throw error;
    }
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.authToken}`,
      'Content-Type': 'application/json',
    };
  }

  async findOrCreateProduct(name: string): Promise<Product> {
    console.log(`\n📦 Procurando produto "${name}"...`);

    try {
      // Try to find existing product
      const response = await axios.get(
        `${this.baseUrl}/api/products/`,
        { 
          headers: this.getHeaders(),
          timeout: 10000,
          httpsAgent: undefined
        }
      );

      const existing = response.data.find((p: Product) => p.name === name);
      if (existing) {
        console.log(`✅ Produto encontrado com ID: ${existing.id}`);
        return existing;
      }

      // Create new product
      console.log(`⏳ Produto não encontrado, criando...`);
      const createResponse = await axios.post(
        `${this.baseUrl}/api/products/`,
        { name },
        { 
          headers: this.getHeaders(),
          timeout: 10000,
          httpsAgent: undefined
        }
      );
      
      console.log(`✅ Produto criado com ID: ${createResponse.data.id}`);
      return createResponse.data;
    } catch (error: any) {
      console.error('❌ Erro ao buscar/criar produto:', error.message);
      if (error.response?.data) {
        console.error('Detalhes:', error.response.data);
      }
      throw error;
    }
  }

  async createTestPlan(name: string, productId: number): Promise<TestPlan> {
    console.log(`\n📋 Criando plano de teste "${name}"...`);

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/plans/`,
        {
          name,
          product: productId,
          is_active: true,
        },
        { 
          headers: this.getHeaders(),
          timeout: 10000,
          httpsAgent: undefined
        }
      );
      
      console.log(`✅ Plano de teste criado com ID: ${response.data.id}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Erro ao criar plano de teste:', error.message);
      if (error.response?.data) {
        console.error('Detalhes:', error.response.data);
      }
      throw error;
    }
  }

  async setupEscapeKit(): Promise<void> {
    console.log('🚀 Iniciando configuração automática do Kiwi TCMS...\n');

    try {
      await this.authenticate();
      
      const product = await this.findOrCreateProduct('EscapeKit');
      const testPlan = await this.createTestPlan('Main Test Plan', product.id);

      console.log('\n📝 ==========================================');
      console.log('✅ Configuração completada com sucesso!');
      console.log('==========================================');
      console.log(`Product ID: ${product.id}`);
      console.log(`Test Plan ID: ${testPlan.id}`);
      console.log('\n📋 Próximo passo: Atualize config/kiwi-tcms.json:');
      console.log(`   "defaultPlanId": ${testPlan.id}`);
      console.log('==========================================\n');

      // Update config file
      const configPath = 'config/kiwi-tcms.json';
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      config.defaultPlanId = testPlan.id;
      
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`\n📄 Configuração atualizada em ${configPath}:`);
      console.log(JSON.stringify(config, null, 2));

      return;
    } catch (error: any) {
      console.error('\n❌ Falha na configuração automática');
      if (error.message.includes('ECONNREFUSED')) {
        console.error('💡 O Kiwi TCMS não está acessível. Verifique se os containers estão rodando.');
      } else if (error.message.includes('self-signed')) {
        console.error('💡 O certificado SSL é autoassinado. Isso pode causar problemas de autenticação.');
        console.error('💡 Solução: Acesse o Kiwi TCMS via navegador e configure manualmente.');
      } else if (error.response?.status === 301) {
        console.error('?? O Kiwi TCMS está redirecionando para HTTPS.');
        console.error('💡 Solução: Configure manualmente via navegador em http://localhost:8080');
      }
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const config = JSON.parse(readFileSync('config/kiwi-tcms.json', 'utf-8'));

  // Try HTTP first
  const setup = new KiwiTCMSAutoSetup(
    'http://localhost:8080',
    config.username,
    config.password
  );

  try {
    await setup.setupEscapeKit();
  } catch (error) {
    console.log('\n⚠️  Não foi possível conectar via HTTP.');
    console.log('💡 Isso geralmente acontece quando o Kiwi TCMS está configurado para HTTPS.');
    console.log('\n📋 Instruções para configuração manual:');
    console.log('1. Acesse http://localhost:8080 no navegador');
    console.log('2. Aceite o certificado autoassinado (Avançado → Prosseguir)');
    console.log('3. Faça login com admin/admin');
    console.log('4. Crie o produto "EscapeKit" e anote o Product ID');
    console.log('5. Crie o plano de teste "Main Test Plan" e anote o Test Plan ID');
    console.log('6. Atualize config/kiwi-tcms.json com o Test Plan ID');
    console.log('7. Execute o upload com: npx tsx scripts/kiwi-upload.ts --file vitest-results.json --framework vitest');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}