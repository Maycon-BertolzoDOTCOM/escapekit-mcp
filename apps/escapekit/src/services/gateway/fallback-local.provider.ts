// src/services/gateway/fallback-local.provider.ts
import { AIProvider, InferenceParams, InferenceResult, ProviderMetrics } from './provider.interface';

export class FallbackLocalProvider implements AIProvider {
  readonly name = 'fallback-local';
  readonly priority = 999;    // último recurso
  readonly costPerToken = 0;

  private totalCalls = 0;
  private successCalls = 0;
  private errorCalls = 0;
  private latencies: number[] = [];

  async call(params: InferenceParams): Promise<InferenceResult> {
    const start = Date.now();
    
    try {
      // Simulação local bem elaborada para simulação de pisos
      let responseText: string;
      
      // Análise do prompt para gerar resposta contextualizada
      const promptLower = params.prompt.toLowerCase();
      
      if (promptLower.includes('piso') || promptLower.includes('cerâmica') || promptLower.includes('madeira')) {
        responseText = `[Local Fallback - Simulação Realista] \n` +
                      `Para o ambiente mostrado na imagem: \n` +
                      `• Recomendação: Piso cerâmico com acabamento fosco \n` +
                      `• Cor: Tons terrosos (bege, cinza claro) \n` +
                      `• Dimensão: 60x60cm para melhor vazão \n` +
                      `• Aplicação: Ideal para áreas residenciais com tráfego moderado \n` +
                      `• Custo estimado: R$ 45-65/m²`;
      } else if (promptLower.includes('azulejo') || promptLower.includes('revestimento')) {
        responseText = `[Local Fallback - Revestimento] \n` +
                      `Para a área molhada identificada: \n` +
                      `• Recomendação: Porcelanato com tecnologia antiderrapante \n` +
                      `• Acabamento: Semibrilho para fácil limpeza \n` +
                      `• Instalação: Com juntas de 2mm para vazão \n` +
                      `• Características: Resistente à umidade e produtos químicos`;
      } else {
        responseText = `[Local Fallback - Análise Geral] \n` +
                      `Baseado na análise visual: \n` +
                      `• Ambiente: Apresenta boa luminosidade natural \n` +
                      `• Dimensões: Espaço adequado para piso dimensionado \n` +
                      `• Recomendação geral: Consulte catálogo para escolha final`;
      }
      
      // Simula tempo de processamento da IA (entre 300-800ms)
      const processingTime = 300 + Math.random() * 500;
      await new Promise(resolve => setTimeout(resolve, processingTime));
      
      const latency = Date.now() - start;
      this.recordSuccess(latency);
      
      return { 
        text: responseText,
        usage: {
          promptTokens: params.prompt.length,
          completionTokens: responseText.length,
          totalTokens: params.prompt.length + responseText.length
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido no fallback local';
      this.recordFailure(new Error(errorMessage));
      throw new Error(`Fallback local falhou: ${errorMessage}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    // Fallback local sempre está disponível
    // Simula pequeno delay para ser realista
    await new Promise(resolve => setTimeout(resolve, 50));
    return true;
  }

  getMetrics(): ProviderMetrics {
    const avgLatency = this.latencies.length 
      ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length 
      : 0;
    const errorRate = this.totalCalls ? this.errorCalls / this.totalCalls : 0;
    const score = avgLatency + (errorRate * 1000);
    
    return {
      name: this.name,
      totalCalls: this.totalCalls,
      successCalls: this.successCalls,
      errorCalls: this.errorCalls,
      avgLatencyMs: avgLatency,
      score
    };
  }

  recordSuccess(latencyMs: number): void {
    this.totalCalls++;
    this.successCalls++;
    this.latencies.push(latencyMs);
    if (this.latencies.length > 100) this.latencies.shift();
  }

  recordFailure(error: Error): void {
    this.totalCalls++;
    this.errorCalls++;
    console.warn(`[${this.name}] Fallback local falhou: ${error.message}`);
  }
}