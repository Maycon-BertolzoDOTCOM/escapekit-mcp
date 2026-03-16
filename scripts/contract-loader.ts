<![<!import * as yaml from 'yaml';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface InputSpec {
  name: string;
  type: string;
  description: string;
  examples: any[];
}

export interface OutputSpec {
  name: string;
  type: string;
  description: string;
  examples: any[];
}

export interface BehaviorSpec {
  inputs: InputSpec[];
  outputs: OutputSpec[];
  edgeCases: string[];
  errorConditions: string[];
}

export interface TestScenario {
  name: string;
  description: string;
  input: any;
  expectedOutput: any;
  shouldFail?: boolean;
}

export interface Contract {
  name: string;
  description: string;
  behavior: BehaviorSpec;
  testScenarios: TestScenario[];
}

export class ContractLoader {
  private knowledgeBasePath: string;

  constructor(knowledgeBasePath: string = 'knowledge-base') {
    this.knowledgeBasePath = knowledgeBasePath;
  }

  async loadContract(detectorName: string): Promise<Contract | null> {
    try {
      const contractPath = path.join(
        this.knowledgeBasePath,
        `${detectorName}.yaml`
      );
      
      const content = await fs.readFile(contractPath, 'utf-8');
      return yaml.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log(`No contract found for ${detectorName}`);
        return null;
      }
      throw new Error(`Error loading contract for ${detectorName}: ${error.message}`);
    }
  }

  async loadAllContracts(): Promise<Map<string, Contract>> {
    const contracts = new Map<string, Contract>();
    
    try {
      const files = await fs.readdir(this.knowledgeBasePath);
      const yamlFiles = files.filter(f => f.endsWith('.yaml'));
      
      for (const file of yamlFiles) {
        const content = await fs.readFile(
          path.join(this.knowledgeBasePath, file),
          'utf-8'
        );
        const contract = yaml.parse(content);
        const name = file.replace('.yaml', '');
        contracts.set(name, contract);
      }
    } catch (error) {
      console.log('Error loading contracts:', error);
    }
    
    return contracts;
  }
}
