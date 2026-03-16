/**
 * Recommendation Engine
 * 
 * Generates contextual recommendations for detected issues
 */

import { existsSync } from 'fs';
import { resolve } from 'path';

import type { Recommendation, RecommendationContext, RecommendationEngineOptions, RecommendationTemplate } from './types.js';

export class RecommendationEngine {
  private templateCache: Map<string, RecommendationTemplate> = new Map();

  constructor() {
    this.loadTemplates();
  }

  /**
   * Load all recommendation templates from templates directory
   */
  private loadTemplates(): void {
    const templatesDir = resolve(__dirname, 'templates');
    
    if (!existsSync(templatesDir)) {
      console.warn(`Templates directory not found: ${templatesDir}`);
      return;
    }

    const yaml = require('yaml');
    
    try {
      const fs = require('fs');
      const files = fs.readdirSync(templatesDir).filter((f: string) => f.endsWith('.yaml'));
      
      for (const file of files) {
        const filePath = resolve(templatesDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const template = yaml.parse(content) as RecommendationTemplate;
        
        if (template.id) {
          this.templateCache.set(template.id, template);
        }
      }
      
      console.log(`RecommendationEngine: Loaded ${this.templateCache.size} templates`);
    } catch (error) {
      console.warn('Error loading recommendation templates:', error);
    }
  }

  /**
   * Generate a recommendation based on problem type and context
   */
  async generate(options: RecommendationEngineOptions): Promise<Recommendation> {
    const { problemType, context = {} } = options;

    // Try to find a matching template
    const template = this.templateCache.get(problemType);
    
    if (!template) {
      // Return a generic recommendation if no template found
      return this.generateGenericRecommendation(problemType, context);
    }

    // Build recommendation from template
    const recommendation: Recommendation = {
      id: template.id,
      title: template.title,
      description: template.description,
      severity: template.severity,
      problemType: problemType,
      steps: this.extractSteps(template),
      commands: this.extractCommands(template),
      references: this.extractReferences(template),
    };

    // Add context-specific notes if available
    if (context.framework) {
      recommendation.description += `\n\nDetected framework: ${context.framework}`;
    }

    return recommendation;
  }

  /**
   * Generate a generic recommendation for unknown problem types
   */
  private generateGenericRecommendation(problemType: string, _context: RecommendationContext): Recommendation {
    return {
      id: `generic-${problemType}`,
      title: `Fix detected issue: ${problemType}`,
      description: `An issue was detected of type '${problemType}'. Review the analysis output for more details.`,
      severity: 'error',
      problemType: problemType,
      steps: [
        'Review the analysis output for specific details about this issue',
        'Identify the affected files and code sections',
        'Apply the necessary fixes based on the issue type',
        'Run escapekit validate to verify the fix',
      ],
      references: [
        'https://github.com/escapekit/escapekit-mcp/issues',
      ],
    };
  }

  /**
   * Extract steps from template's recommended actions
   */
  private extractSteps(template: RecommendationTemplate): string[] {
    const steps: string[] = [];
    
    if (template.recommendedActions && template.recommendedActions.length > 0) {
      // Use steps from the first recommended action
      const action = template.recommendedActions[0];
      if (action.steps && action.steps.length > 0) {
        steps.push(...action.steps);
      }
    }
    
    return steps;
  }

  /**
   * Extract commands from template's recommended actions
   */
  private extractCommands(template: RecommendationTemplate): string[] | undefined {
    const commands: string[] = [];
    
    if (template.recommendedActions) {
      for (const action of template.recommendedActions) {
        if (action.commands && action.commands.length > 0) {
          commands.push(...action.commands);
        }
      }
    }
    
    return commands.length > 0 ? commands : undefined;
  }

  /**
   * Extract references from template
   */
  private extractReferences(template: RecommendationTemplate): string[] | undefined {
    const references: string[] = [];
    
    if (template.recommendedActions) {
      for (const action of template.recommendedActions) {
        if (action.references && action.references.length > 0) {
          references.push(...action.references);
        }
      }
    }
    
    return references.length > 0 ? references : undefined;
  }

  /**
   * Format recommendation as Markdown
   */
  formatAsMarkdown(recommendation: Recommendation): string {
    const icon = recommendation.severity === 'error' ? '🔴' : '🟡';
    let markdown = `\n${icon} ${recommendation.title}\n`;
    markdown += `${recommendation.description}\n`;
    
    if (recommendation.steps && recommendation.steps.length > 0) {
      markdown += '\n📋 Steps to fix:\n';
      recommendation.steps.forEach((step, index) => {
        markdown += `   ${index + 1}. ${step}\n`;
      });
    }
    
    if (recommendation.commands && recommendation.commands.length > 0) {
      markdown += '\n🚀 Quick Fix Commands:\n';
      recommendation.commands.forEach(cmd => {
        markdown += `   ${cmd}\n`;
      });
    }
    
    if (recommendation.references && recommendation.references.length > 0) {
      markdown += '\n📚 References:\n';
      recommendation.references.forEach(ref => {
        markdown += `   ${ref}\n`;
      });
    }
    
    return markdown;
  }

  /**
   * Get quick fix commands for a recommendation
   */
  getQuickFixCommands(recommendation: Recommendation): string[] {
    return recommendation.commands || [];
  }

  /**
   * Get all loaded template IDs
   */
  getLoadedTemplateIds(): string[] {
    return Array.from(this.templateCache.keys());
  }

  /**
   * Check if a template exists for a problem type
   */
  hasTemplate(problemType: string): boolean {
    return this.templateCache.has(problemType);
  }
}
