import axios from 'axios';
import { AIProvider, InferenceParams, InferenceResult, ProviderMetrics } from './provider.interface';

interface ProviderResult {
  success: boolean;
  data?: {
    image: Buffer;
    analysis: string;
    provider: string;
  };
  error?: string;
  provider: string;
  processingTime?: number;
}

export class WaveSpeedAIProvider implements AIProvider {
  readonly name = 'wavespeed-ai';
  readonly priority = 1; // Prioridade máxima para simulação visual
  readonly costPerToken = 0.01; // Custo estimado por token
  
  private apiKey: string;
  private baseUrl: string;
  private metrics: ProviderMetrics;

  constructor() {
    this.apiKey = 'c991efe84cdc51b48e213c37392090a643c46d609cf67090f518b0c86d1a014e';
    this.baseUrl = 'https://api.wavespeed.ai/v1';
    
    this.metrics = {
      name: this.name,
      totalCalls: 0,
      successCalls: 0,
      errorCalls: 0,
      avgLatencyMs: 0,
      score: 0.5 // Score inicial
    };
  }

  async healthCheck(): Promise<boolean> {
    return this.isHealthy();
  }

  private async isHealthy(): Promise<boolean> {
    try {
      // Teste simples de saúde da API
      const response = await axios.get(`${this.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        timeout: 10000
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async processImage(imageBuffer: Buffer, prompt: string): Promise<ProviderResult> {
    const startTime = Date.now();
    this.metrics.totalCalls++;
    
    try {
      const imageBase64 = imageBuffer.toString('base64');
      
      const payload = {
        model: 'qwen-image-edit',
        image: imageBase64,
        prompt: this.buildFloorPrompt(prompt),
        negative_prompt: 'deformed, bad anatomy, distorted, unrealistic, blurry, low quality, wrong perspective',
        num_inference_steps: 25,
        guidance_scale: 7.5,
        width: 1024,
        height: 1024
      };

      console.log(`[WaveSpeedAI] Processando imagem com prompt: ${prompt}`);
      
      const response = await axios.post(`${this.baseUrl}/images/edits`, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 45000
      });

      const processingTime = Date.now() - startTime;
      const result = response.data;
      
      this.recordSuccess(processingTime);
      
      if (result.image_base64) {
        console.log(`[WaveSpeedAI] Sucesso em ${processingTime}ms`);
        return {
          success: true,
          data: {
            image: Buffer.from(result.image_base64, 'base64'),
            analysis: `Piso simulado: ${prompt}`,
            provider: this.name
          },
          provider: this.name,
          processingTime
        };
      } else if (result.image_url) {
        // Baixar a imagem da URL
        const imageResponse = await axios.get(result.image_url, { 
          responseType: 'arraybuffer',
          timeout: 30000
        });
        
        console.log(`[WaveSpeedAI] Sucesso (via URL) em ${processingTime}ms`);
        return {
          success: true,
          data: {
            image: Buffer.from(imageResponse.data),
            analysis: `Piso simulado: ${prompt}`,
            provider: this.name
          },
          provider: this.name,
          processingTime
        };
      } else {
        throw new Error('Resposta da API não contém imagem');
      }
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      console.error(`[WaveSpeedAI] Erro em ${processingTime}ms:`, error.message);
      
      this.recordFailure(error);
      
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        provider: this.name
      };
    }
  }

  async call(params: InferenceParams): Promise<InferenceResult> {
    const imageBuffer = typeof params.image === 'string' 
      ? Buffer.from(params.image, 'base64') 
      : params.image;
    
    const result = await this.processImage(imageBuffer, params.prompt);
    
    if (result.success) {
      return {
        text: result.data!.analysis,
        usage: {
          promptTokens: params.prompt.length / 4, // Estimativa
          completionTokens: result.data!.analysis.length / 4,
          totalTokens: (params.prompt.length + result.data!.analysis.length) / 4
        }
      };
    } else {
      throw new Error(result.error || 'Erro desconhecido na API WaveSpeedAI');
    }
  }

  getMetrics(): ProviderMetrics {
    return { ...this.metrics };
  }

  recordSuccess(latencyMs: number, _usage?: any): void {
    this.metrics.successCalls++;
    
    // Atualiza latência média
    if (this.metrics.avgLatencyMs === 0) {
      this.metrics.avgLatencyMs = latencyMs;
    } else {
      this.metrics.avgLatencyMs = (this.metrics.avgLatencyMs + latencyMs) / 2;
    }
    
    // Calcula score (menor = melhor)
    const successRate = this.metrics.successCalls / this.metrics.totalCalls;
    const latencyScore = Math.min(latencyMs / 10000, 1.0); // Máximo 10s = 1.0 score
    this.metrics.score = (1 - successRate) + latencyScore;
  }

  recordFailure(error: Error): void {
    this.metrics.errorCalls++;
    this.metrics.lastError = error.message;
    
    // Atualiza score para pior
    const failureRate = this.metrics.errorCalls / this.metrics.totalCalls;
    this.metrics.score += failureRate * 0.5; // Penalidade por falhas
  }

  private buildFloorPrompt(prompt: string): string {
    return `Replace the entire floor with ${prompt}. Keep all furniture, lighting, shadows, room layout, walls, ceiling and decorations exactly as they are. The new floor should look photorealistic, perfectly integrated with the room's style and lighting conditions.`;
  }
}