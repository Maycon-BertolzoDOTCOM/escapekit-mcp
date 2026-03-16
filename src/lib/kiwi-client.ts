import axios from 'axios';
import { logger } from '../logger';

export class KiwiClient {
  private authToken: string | null = null;

  constructor(private config: {
    baseUrl: string;
    username: string;
    password: string;
    timeout?: number;
  }) {}

  async authenticate() {
    try {
      const response = await axios.post(`${this.config.baseUrl}/api/auth/login/`, {
        username: this.config.username,
        password: this.config.password
      });
      this.authToken = response.data.token;
      return true;
    } catch (error) {
      logger.error('Kiwi TCMS authentication failed', { error });
      return false;
    }
  }

  async createTestRun(name: string, planId: number) {
    if (!this.authToken) await this.authenticate();
    
    try {
      const response = await axios.post(
        `${this.config.baseUrl}/api/testruns/`,
        { name, plan: planId },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      logger.error('Failed to create test run', { error });
      throw error;
    }
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json'
    };
  }
}