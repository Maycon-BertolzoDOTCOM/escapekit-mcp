import * as fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';

export interface Config {
  ignorePatterns: string[];
  failureThreshold: 'high' | 'critical';
  contractIds: string[];
}

export class ConfigLoader {
  static async load(configPath: string): Promise<Config> {
    const defaultConfig: Config = {
      ignorePatterns: [],
      failureThreshold: 'high',
      contractIds: []
    };

    if (!fs.existsSync(configPath)) {
      core.warning(`Config file not found at ${configPath}, using defaults`);
      return defaultConfig;
    }

    try {
      const rawConfig = fs.readFileSync(configPath, 'utf8');
      const userConfig = JSON.parse(rawConfig);
      
      return {
        ignorePatterns: userConfig.ignorePatterns || defaultConfig.ignorePatterns,
        failureThreshold: ['high', 'critical'].includes(userConfig.failureThreshold) 
          ? userConfig.failureThreshold 
          : defaultConfig.failureThreshold,
        contractIds: userConfig.contractIds || defaultConfig.contractIds
      };
    } catch (error) {
      core.warning(`Failed to parse config file: ${error instanceof Error ? error.message : String(error)}`);
      return defaultConfig;
    }
  }
}