/**
 * Contract Validator
 * Valida estrutura e conteúdo de contratos factuais YAML
 */

import yaml from 'js-yaml';

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export class ContractValidator {
  /**
   * Valida um contrato YAML
   */
  validate(contractYaml: string): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      warnings: [],
      errors: [],
    };

    let data: any;

    // Parse YAML
    try {
      data = yaml.load(contractYaml);
    } catch (error) {
      result.errors.push(`Erro de sintaxe YAML: ${(error as Error).message}`);
      result.valid = false;
      return result;
    }

    // Valida seções obrigatórias
    const requiredSections = ['source', 'facts', 'patterns', 'rules', 'cases'];
    for (const section of requiredSections) {
      if (!data[section]) {
        result.errors.push(`Seção obrigatória ausente: ${section}`);
        result.valid = false;
      }
    }

    if (!result.valid) {
      return result;
    }

    // Valida source
    if (!data.source.title) {
      result.errors.push('source.title é obrigatório');
      result.valid = false;
    }

    // Valida facts
    if (!Array.isArray(data.facts)) {
      result.errors.push('facts deve ser um array');
      result.valid = false;
    } else {
      data.facts.forEach((fact: any, index: number) => {
        if (!fact.id) {
          result.errors.push(`Fact[${index}]: id é obrigatório`);
          result.valid = false;
        }
        if (!fact.statement) {
          result.warnings.push(`Fact[${fact.id || index}]: statement ausente`);
        }
        if (fact.type && !['fact', 'claim', 'observation'].includes(fact.type)) {
          result.warnings.push(`Fact[${fact.id || index}]: tipo '${fact.type}' desconhecido`);
        }
        if (fact.relevance && !['security', 'portability', 'performance', 'compatibility'].includes(fact.relevance)) {
          result.warnings.push(`Fact[${fact.id || index}]: relevância '${fact.relevance}' desconhecida`);
        }
      });
    }

    // Valida patterns
    if (!Array.isArray(data.patterns)) {
      result.errors.push('patterns deve ser um array');
      result.valid = false;
    } else {
      data.patterns.forEach((pattern: any, index: number) => {
        if (!pattern.id) {
          result.errors.push(`Pattern[${index}]: id é obrigatório`);
          result.valid = false;
        }
        if (!pattern.description) {
          result.warnings.push(`Pattern[${pattern.id || index}]: description ausente`);
        }
        if (!pattern.evidence || !Array.isArray(pattern.evidence)) {
          result.warnings.push(`Pattern[${pattern.id || index}]: evidence deve ser um array`);
        }
      });
    }

    // Valida rules
    if (!Array.isArray(data.rules)) {
      result.errors.push('rules deve ser um array');
      result.valid = false;
    } else {
      data.rules.forEach((rule: any, index: number) => {
        if (!rule.id) {
          result.errors.push(`Rule[${index}]: id é obrigatório`);
          result.valid = false;
        }
        if (!rule.principle) {
          result.warnings.push(`Rule[${rule.id || index}]: principle ausente`);
        }
        if (rule.action && !['implement_detector', 'add_test', 'create_polyfill'].includes(rule.action)) {
          result.warnings.push(`Rule[${rule.id || index}]: ação '${rule.action}' desconhecida`);
        }
        if (rule.priority && !['high', 'medium', 'low'].includes(rule.priority)) {
          result.warnings.push(`Rule[${rule.id || index}]: prioridade '${rule.priority}' desconhecida`);
        }
      });
    }

    // Valida cases
    if (!Array.isArray(data.cases)) {
      result.errors.push('cases deve ser um array');
      result.valid = false;
    } else {
      data.cases.forEach((caseItem: any, index: number) => {
        if (!caseItem.id) {
          result.errors.push(`Case[${index}]: id é obrigatório`);
          result.valid = false;
        }
        if (!caseItem.description) {
          result.warnings.push(`Case[${caseItem.id || index}]: description ausente`);
        }
      });
    }

    // Valida consistência: rules devem referenciar patterns existentes
    const patternIds = new Set(data.patterns?.map((p: any) => p.id) || []);
    data.rules?.forEach((rule: any) => {
      if (rule.derived_from) {
        rule.derived_from.forEach((patternId: string) => {
          if (!patternIds.has(patternId)) {
            result.warnings.push(`Rule[${rule.id}]: referencia pattern inexistente '${patternId}'`);
          }
        });
      }
    });

    // Valida consistência: cases devem referenciar facts existentes
    const factIds = new Set(Array.isArray(data.facts) ? data.facts.map((f: any) => f.id) : []);
    data.cases?.forEach((caseItem: any) => {
      if (caseItem.related_facts) {
        caseItem.related_facts.forEach((factId: string) => {
          if (!factIds.has(factId)) {
            result.warnings.push(`Case[${caseItem.id}]: referencia fact inexistente '${factId}'`);
          }
        });
      }
    });

    return result;
  }
}
