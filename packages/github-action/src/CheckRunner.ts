import * as core from '@actions/core';
import * as github from '@actions/github';
import { createGovernanceStack } from '@codememoria/core';
import { Config } from './ConfigLoader';
import * as minimatch from 'minimatch';

export interface CheckResult {
  riskLevel: string;
  passports: any[]; // Replace with proper GovernancePassport type
  fileResults: {
    filePath: string;
    riskLevel: string;
    validationCount: number;
  }[];
}

export class CheckRunner {
  constructor(private config: Config) {}

  async execute(): Promise<CheckResult> {
    const octokit = github.getOctokit(core.getInput('github-token'));
    
    // Get modified files in PR
    const { data: files } = await octokit.rest.pulls.listFiles({
      ...github.context.repo,
      pull_number: github.context.payload.pull_request?.number || 0
    });
    
    // Filter by ignore patterns
    const filesToAnalyze = files
      .map(file => file.filename)
      .filter(file => !this.config.ignorePatterns.some(
        pattern => minimatch(file, pattern)
      ));
    
    // Analyze each file
    const passports = await Promise.all(
      filesToAnalyze.map(async filePath => {
        const code = await this.readFileContent(octokit, filePath);
        return createGovernanceStack({ 
          code, 
          filePath,
          contractIds: this.config.contractIds
        });
      })
    );
    
    // Calculate aggregate risk
    const riskLevel = this.calculateAggregateRisk(passports);
    
    return {
      riskLevel,
      passports,
      fileResults: passports.map(p => ({
        filePath: p.filePath,
        riskLevel: p.riskLevel,
        validationCount: p.validations?.length || 0
      }))
    };
  }
  
  private async readFileContent(octokit: any, filePath: string): Promise<string> {
    // Implementation for reading file content from repo
    // Would use GitHub API or local checkout in real implementation
    return ''; // Placeholder
  }
  
  private calculateAggregateRisk(passports: any[]): string {
    const riskValues = passports.map(p => {
      switch(p.riskLevel) {
        case 'critical': return 4;
        case 'high': return 3;
        case 'medium': return 2;
        case 'low': return 1;
        default: return 0;
      }
    });
    
    const avgRisk = riskValues.reduce((a, b) => a + b, 0) / riskValues.length;
    
    if (avgRisk >= 3.5) return 'critical';
    if (avgRisk >= 2.5) return 'high';
    if (avgRisk >= 1.5) return 'medium';
    return 'low';
  }
}