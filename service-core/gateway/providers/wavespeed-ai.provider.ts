import axios from 'axios';
import { BaseProvider, ProviderResult } from '../types';

export class WaveSpeedAIProvider implements BaseProvider {
  name = 'wavespeed-ai';
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = 'c991efe84cdc51b48e213c37392090a643c46d609cf67090f518b0c86d1a014e';
    this.baseUrl = 'https://api.wavespeed.ai/v1';
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Teste simples de saúde da API
      const response = await axios.get(`${this.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async processImage(imageBuffer: Buffer, prompt: string): Promise<ProviderResult> {
    try {
      const imageBase64 = imageBuffer.toString('base64');
      
      const payload = {
        model: 'qwen-image-edit',
        image: imageBase64,
        prompt: `Replace the floor with ${prompt}. Keep the lighting, shadows, furniture and room layout exactly as they are. The new floor should look realistic and match the room style.`,
        negative_prompt: 'deformed, bad anatomy, distorted, unrealistic, blurry, low quality',
        num_inference_steps: 25,
        guidance_scale: 7.5,
        width: 1024,
        height: 1024
      };

      const response = await axios.post(`${this.baseUrl}/images/edits`, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const result = response.data;
      
      if (result.image_base64) {
        return {
          success: true,
          data: Buffer.from(result.image_base64, 'base64'),
          provider: this.name,
          processingTime: response.headers['x-response-time'] || Date.now()
        };
      } else if (result.image_url) {
        // Baixar a imagem da URL
        const imageResponse = await axios.get(result.image_url, { 
          responseType: 'arraybuffer',
          timeout: 30000
        });
        
        return {
          success: true,
          data: Buffer.from(imageResponse.data),
          provider: this.name,
          processingTime: response.headers['x-response-time'] || Date.now()
        };
      } else {
        throw new Error('Resposta da API não contém imagem');
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        provider: this.name
      };
    }
  }

  getScore(): number {
    return 0.9; // Alta qualidade para inpainting
  }
}