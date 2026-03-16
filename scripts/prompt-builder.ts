<![import { DetectorAnalysis } from './ast-analyzer';
import { Contract } from './contract-loader';

export interface PromptContext {
  analysis: DetectorAnalysis;
  contract?: Contract;
  targetFramework: 'vitest' | 'jest';
  includePropertyBased: boolean;
}

export class PromptBuilder {
  build(context: PromptContext): string {
    let prompt = `# Generate Unit Tests for Detector: ${context.analysis.className}\n\n`;
    
    prompt += `## Detector Location\n`;
    prompt += `File: ${context.analysis.filePath}\n\n`;
    
    prompt += `## Analysis\n`;
    prompt += this.formatAnalysis(context.analysis);
    
    if (context.contract) {
      prompt += `\n## Factual Contract\n`;
      prompt += this.formatContract(context.contract);
    }
    
    prompt += `\n## Requirements\n`;
    prompt += this.formatRequirements(context);
    
    return prompt;
  }

  private formatAnalysis(analysis: DetectorAnalysis): string {
    let text = '';
    
    text += `### Methods\n`;
    for (const method of analysis.methods) {
      text += `- ${method.name}(${this.formatParameters(method.parameters)}): ${method.returnType}\n`;
      if (method.isAsync) text += `  (async)\n`;
      if (method.visibility !== 'public') text += `  (${method.visibility})\n`;
    }
    
    text += `\n### Dependencies\n`;
    for (const dep of analysis.dependencies) {
      text += `- ${dep}\n`;
    }
    
    text += `\n### Imports\n`;
    for (const imp of analysis.imports) {
      if (imp.defaultImport) {
        text += `- import ${imp.defaultImport} from '${imp.module}'\n`;
      }
      if (imp.namedImports && imp.namedImports.length > 0) {
        text += `- import { ${imp.namedImports.join(', ')} } from '${imp.module}'\n`;
      }
    }
    
    return text;
  }

  private formatParameters(params: any[]): string {
    return params.map(p => 
      `${p.name}: ${p.type}${p.isOptional ? '?' : ''}`
    ).join(', ');
  }

  private formatContract(contract: Contract): string {
    let text = `**Description**: ${contract.description}\n\n`;
    
    text += `### Behavior\n`;
    text += `**Inputs**: ${contract.behavior.inputs.map(i => i.name).join(', ')}\n`;
    text += `**Outputs**: ${contract.behavior.outputs.map(o => o.name).join(', ')}\n`;
    
    text += `\n### Edge Cases\n`;
    for (const edgeCase of contract.behavior.edgeCases) {
      text += `- ${edgeCase}\n`;
    }
    
    text += `\n### Test Scenarios\n`;
    for (const scenario of contract.testScenarios) {
      text += `- ${scenario.name}: ${scenario.description}\n`;
    }
    
    return text;
  }

  private formatRequirements(context: PromptContext): string {
    let reqs = '';
    
    reqs += `- Use ${context.targetFramework.toUpperCase()} as test framework\n`;
    reqs += `- Generate comprehensive tests covering all methods\n`;
    reqs += `- Include test cases for edge cases and error conditions\n`;
    reqs += `- Each test should have a descriptive name\n`;
    reqs += `- Include assertions to verify expected behavior\n`;
    reqs += `- Use proper mocking for external dependencies\n`;
    
    if (context.includePropertyBased) {
      reqs += `- Include property-based tests using fast-check for complex scenarios\n`;
    }
    
    reqs += `\n### Return\n`;
    reqs += `Return only the complete TypeScript code for the test file.\n`;
    reqs += `Do not include any explanations, comments outside the code, or markdown formatting.\n`;
    
    return reqs;
  }

  buildRefinementPrompt(originalCode: string, errorMessage: string): string {
    return `# Fix Test Code

The following test code has an error:
${errorMessage}

## Original Code
\`\`\`typescript
${originalCode}
\`\`\`

## Task
Fix the test code to resolve the error while maintaining the test intent.
Return only the corrected TypeScript code, no explanations.`;
  }
}
