import { createGovernanceStack } from '@codememoria/core';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

type CachedPassport = {
  timestamp: number;
  passport: any; // Replace with proper GovernancePassport type
};

export class GovernanceBridge {
  private static cache = new Map<string, CachedPassport>();
  
  static async analyzeFile(filePath: string): Promise<any> { // Replace return type
    // Check cache first
    const cached = this.cache.get(filePath);
    if (cached && Date.now() - cached.timestamp < 30000) {
      return cached.passport;
    }
    
    try {
      const code = fs.readFileSync(filePath, 'utf8');
      const passport = await createGovernanceStack({
        code,
        filePath,
        // Include same parameters as CLI
      });
      
      // Update cache
      this.cache.set(filePath, {
        timestamp: Date.now(),
        passport
      });
      
      return passport;
    } catch (error) {
      throw new Error(`Governance analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  static getLastPassport(filePath: string): any | null { // Replace return type
    return this.cache.get(filePath)?.passport || null;
  }
}
