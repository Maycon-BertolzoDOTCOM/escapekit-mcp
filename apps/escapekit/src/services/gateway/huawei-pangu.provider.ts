// src/services/gateway/huawei-pangu.provider.ts
import { AIProvider, InferenceParams, InferenceResult, ProviderMetrics } from './provider.interface';

export class HuaweiPanguProvider implements AIProvider {
  readonly name = 'huawei-pangu';
  readonly priority = 2;
  readonly costPerToken = 0;  // free tier 1M tokens

  private totalCalls = 0;
  private successCalls = 0;
  private errorCalls = 0;
  private latencies: number[] = [];

  async call(params: InferenceParams): Promise<InferenceResult> {
    const start = Date.now();
    const apiKey = process.env.HUAWEI_API_KEY;
    const projectId = process.env.HUAWEI_PROJECT_ID;
    
    if (!apiKey || !projectId) {
      throw new Error('Huawei credentials missing: HUAWEI_API_KEY and HUAWEI_PROJECT_ID required');
    }

    const imageBase64 = typeof params.image === 'string' 
      ? params.image.replace(/^data:image\/[^;]+;base64,/, '')
      : params.image.toString('base64');

    // Huawei Pangu API endpoint simplificado
    const response = await fetch(`https://pangu.cn-north-4.myhuaweicloud.com/v1/${projectId}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': apiKey,
      },
      body: JSON.stringify({
        model: 'pangu-vision',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: imageBase64
                }
              },
              {
                type: 'text',
                text: params.prompt
              }
            ]
          }
        ],
        max_tokens: params.maxTokens || 500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Huawei Pangu error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const latency = Date.now() - start;
    this.recordSuccess(latency);

    const text = data.choices?.[0]?.message?.content || 
                 data.result?.choices?.[0]?.text ||
                 'Resposta padrão Huawei';
    
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