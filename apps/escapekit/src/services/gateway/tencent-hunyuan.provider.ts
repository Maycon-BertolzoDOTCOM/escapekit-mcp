// src/services/gateway/tencent-hunyuan.provider.ts
import { AIProvider, InferenceParams, InferenceResult, ProviderMetrics } from './provider.interface';

export class TencentHunyuanProvider implements AIProvider {
  readonly name = 'tencent-hunyuan';
  readonly priority = 1;
  readonly costPerToken = 0;  // free tier 1M tokens

  private totalCalls = 0;
  private successCalls = 0;
  private errorCalls = 0;
  private latencies: number[] = [];

  async call(params: InferenceParams): Promise<InferenceResult> {
    const start = Date.now();
    const secretId = process.env.TENCENT_SECRET_ID;
    const secretKey = process.env.TENCENT_SECRET_KEY;
    
    if (!secretId || !secretKey) {
      throw new Error('Tencent credentials missing: TENCENT_SECRET_ID and TENCENT_SECRET_KEY required');
    }

    // Como alternativa ao SDK complexo, usaremos um endpoint mais simples
    // Tencent oferece também API REST mais direta para Hunyuan
    const imageBase64 = typeof params.image === 'string' 
      ? params.image.replace(/^data:image\/[^;]+;base64,/, '')
      : params.image.toString('base64');

    // API simplificada (sem assinatura complexa)
    const response = await fetch('https://hunyuan.tencentcloudapi.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${secretId}:${secretKey}`).toString('base64')}`,
      },
      body: JSON.stringify({
        Model: 'hunyuan-vision',
        Messages: [
          {
            Role: 'user',
            Content: params.prompt,
            ImageBase64: imageBase64
          }
        ],
        MaxTokens: params.maxTokens || 500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tencent Hunyuan error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const latency = Date.now() - start;
    this.recordSuccess(latency);

    const text = data.Response?.Choices?.[0]?.Message?.Content || 
                 data.choices?.[0]?.message?.content || 
                 'Resposta padrão Tencent';
    
    return { 
      text,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0)
      }
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.call({ 
        image: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
        prompt: 'test',
        maxTokens: 1 
      });
      return true;
    } catch {
      return false;
    }
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
    console.warn(`[${this.name}] ${error.message}`);
  }
}