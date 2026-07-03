/**
 * SQL Injection Detector
 *
 * Detects SQL injection vulnerabilities via template literal interpolation
 * and string concatenation with SQL keywords.
 */

import { type Issue, generateId } from '../models/schemas.js';

const SQL_TEMPLATE_LITERAL_REGEX =
  /`[^`]*(SELECT|INSERT|UPDATE|DELETE|DROP|EXEC)[^`]*\$\{[^}]+\}[^`]*`/gi;

const SQL_CONCATENATION_REGEX =
  /['"][^'"]*\b(SELECT|INSERT|UPDATE|DELETE|DROP|EXEC)\b[^'"]*['"]\s*\+\s*\S/gi;

const SUGGESTION =
  'Use prepared statements or parameterized queries instead of string interpolation.';

function findPosition(code: string, index: number): { line: number; column: number } {
  try {
    const lines = code.substring(0, index).split('\n');
    return {
      line: lines.length,
      column: (lines[lines.length - 1]?.length ?? 0) + 1,
    };
  } catch {
    return { line: 0, column: 0 };
  }
}

export class SqlInjectionDetector {
  detect(code: string): Issue[] {
    if (code == null) return [];

    const issues: Issue[] = [];

    SQL_TEMPLATE_LITERAL_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = SQL_TEMPLATE_LITERAL_REGEX.exec(code)) !== null) {
      const location = findPosition(code, match.index);
      issues.push({
        id: generateId('issue'),
        type: 'sql_injection',
        severity: 'error',
        location,
        message: 'SQL injection via template literal detected',
        description: 'Template literal interpolates a variable directly into a SQL query.',
        suggestion: SUGGESTION,
        autoFixable: false,
      });
    }

    SQL_CONCATENATION_REGEX.lastIndex = 0;

    while ((match = SQL_CONCATENATION_REGEX.exec(code)) !== null) {
      const location = findPosition(code, match.index);
      issues.push({
        id: generateId('issue'),
        type: 'sql_injection',
        severity: 'error',
        location,
        message: 'SQL injection via string concatenation detected',
        description: 'String concatenation with a SQL keyword enables injection attacks.',
        suggestion: SUGGESTION,
        autoFixable: false,
      });
    }

    return issues;
  }
}
