// src/services/gateway/gateway.orchestrator.ts
import { AIProvider, InferenceParams, InferenceResult } from './provider.interface';

export class GatewayOrchestrator {
  private providers: AIProvider[];
  private reorderInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(providers: AIProvider[], reorderMs: number = 60000) {
    this.providers = [...providers].sort((a, b) => a.priority - b.priority);
    
    // Inicia reordenação dinâmica se tivermos providers
    if (this.providers.length > 1) {
      this.reorderInterval = setInterval(() => this.reorderProviders(), reorderMs);
    }
    
    console.log(`[Gateway] Inicializado com ${this.providers.length} provedores`);
    this.printCurrentOrder();
  }

  private reorderProviders(): void {
    if (this.isShuttingDown || this.providers.length <= 1) return;
    
    const oldOrder = this.providers.map(p => p.name);
    
    // Ordena por score (menor = melhor)
    this.providers.sort((a, b) => {
      const scoreA = a.getMetrics().score;
      const scoreB = b.getMetrics().score;
      return scoreA - scoreB;
    });
    
    const newOrder = this.providers.map(p => p.name);
    
    // Log apenas se a ordem mudou
    if (JSON.stringify(oldOrder) !== JSON.stringify(newOrder)) {
      console.log('[Gateway] Ordem atualizada baseada em métricas:');
      this.printCurrentOrder();
    }
  }

  private printCurrentOrder(): void {
    const orderInfo = this.providers.map((p, index) => 
      `${index + 1}. ${p.name} (score=${p.getMetrics().score.toFixed(2)}, ` +
      `latency=${p.getMetrics().avgLatencyMs.toFixed(1)}ms)`
    ).join(' → ');
    
    console.log(`[Gateway] Ordem atual: ${orderInfo}`);
  }

  async callWithFallback(params: InferenceParams, timeoutMs: number = 30000): Promise<InferenceResult> {
    if (this.providers.length === 0) {
      throw new Error('Nenhum provedor de IA disponível');
    }

    const errors: Error[] = [];
    const startTime = Date.now();

    // Tenta cada provedor na ordem atual
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      
      // Verifica timeout global
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Timeout após ${timeoutMs}ms. Tentativas: ${i}/${this.providers.length}. ` +
                       `Erros: ${errors.map(e => e.message).join('; ')}`);
      }
      
      // Verifica se o provedor está saudável
      try {
        const isHealthy = await provider.healthCheck();
        if (!isHealthy) {
          console.warn(`[Gateway] Provider ${provider.name} não está saudável, pulando`);
          continue;
        }
      } catch (healthError) {
        errors.push(new Error(`${provider.name} health check failed: ${healthError}`));
        continue;
      }
      
      // Tenta realizar a chamada
      try {
        console.log(`[Gateway] Tentando provedor ${i + 1}/${this.providers.length}: ${provider.name}`);
        
        const result = await Promise.race([
          provider.call(params),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout ${provider.name} (${timeoutMs}ms)`)), timeoutMs)
          )
        ]);
        
        console.log(`[Gateway] Sucesso com ${provider.name} em ${Date.now() - startTime}ms`);
        return result;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`[Gateway] Provider ${provider.name} falhou: ${errorMessage}`);
        errors.push(new Error(`${provider.name}: ${errorMessage}`));
        
        // Continua para o próximo provedor
        continue;
      }
    }
    
    // Todos os provedores falharam
    const totalTime = Date.now() - startTime;
    const errorSummary = errors.map((e, idx) => `[${idx + 1}] ${e.message}`).join(' | ');
    
    throw new Error(`Todos os ${this.providers.length} provedores falharam após ${totalTime}ms. ` +
                    `Erros: ${errorSummary}`);
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.reorderInterval) {
      clearInterval(this.reorderInterval);
      this.reorderInterval = null;
    }
    
    // Realiza health check final em todos os provedores
    console.log('[Gateway] Finalizando gateway - status dos provedores:');
    for (const provider of this.providers) {
      try {
        const isHealthy = await provider.healthCheck();
        const metrics = provider.getMetrics();
        console.log(`  ${provider.name}: ${isHealthy ? '✅' : '❌'} ` +
                    `(${metrics.successCalls}/${metrics.totalCalls} sucessos)`);
      } catch {
        console.warn(`  ${provider.name}: ❌ erro no health check`);
      }
    }
    
    console.log('[Gateway] Gateway finalizado');
  }

  // Métodos utilitários para monitoramento
  getProvidersMetrics() {
    return this.providers.map(provider => provider.getMetrics());
  }

  getBestProviderName(): string {
    if (this.providers.length === 0) return 'Nenhum';
    return this.providers[0].name;
  }

  getTotalCalls(): number {
    return this.providers.reduce((sum, provider) => sum + provider.getMetrics().totalCalls, 0);
  }

  getSuccessRate(): number {
    const totalCalls = this.getTotalCalls();
    if (totalCalls === 0) return 0;
    
    const successCalls = this.providers.reduce((sum, provider) => 
      sum + provider.getMetrics().successCalls, 0);
    
    return (successCalls / totalCalls) * 100;
  }
}

// Exporta instância singleton padrão
export default GatewayOrchestrator;