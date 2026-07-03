import type { AnalysisResult, Issue } from '../models/schemas.js';
import { sha256 } from '../governance/utils/hash.js';

export interface NormativeRef {
  standard: 'LGPD' | 'OWASP';
  reference: string;
  description: string;
}

export interface ComplianceIssue {
  id: string;
  type: string;
  severity: string;
  message: string;
  location: { file?: string; line: number; column?: number };
  normativeRefs: NormativeRef[];
}

export interface ComplianceReport {
  reportVersion: '1.0';
  generatedAt: string;       // ISO 8601
  analysisId: string;
  issues: ComplianceIssue[];
  integrityHash: string;     // SHA-256 of content without this field
}

function getNormativeRefs(issueType: string): NormativeRef[] {
  switch (issueType) {
    case 'security_risk':
      return [
        {
          standard: 'OWASP',
          reference: 'OWASP Top 10 A05:2021 – Security Misconfiguration',
          description: 'Insecure configuration can expose sensitive data or system internals.',
        },
      ];
    case 'hardcoded_secret':
      return [
        {
          standard: 'OWASP',
          reference: 'OWASP Top 10 A07:2021 – Identification and Authentication Failures',
          description: 'Hardcoded credentials can be extracted from source code.',
        },
        {
          standard: 'LGPD',
          reference: 'LGPD Art. 46 – Medidas de segurança',
          description: 'Dados pessoais devem ser protegidos por medidas técnicas adequadas.',
        },
      ];
    case 'sql_injection':
      return [
        {
          standard: 'OWASP',
          reference: 'OWASP Top 10 A03:2021 – Injection',
          description: 'Direct variable interpolation in SQL queries enables injection attacks.',
        },
      ];
    case 'postinstall_risk':
      return [
        {
          standard: 'OWASP',
          reference: 'OWASP Top 10 A08:2021 – Software and Data Integrity Failures',
          description: 'Malicious postinstall scripts can compromise the build environment.',
        },
      ];
    case 'unicode_risk':
      return [
        {
          standard: 'OWASP',
          reference: 'OWASP Top 10 A08:2021 – Software and Data Integrity Failures',
          description: 'Unicode homoglyphs and invisible characters can be used for supply chain attacks.',
        },
      ];
    default:
      return [];
  }
}

export class ReportGenerator {
  generate(analysis: AnalysisResult): ComplianceReport {
    const issues: ComplianceIssue[] = (analysis.issues ?? []).map((issue: Issue) => ({
      id: issue.id,
      type: issue.type,
      severity: issue.severity,
      message: issue.message,
      location: {
        ...(issue.location.file !== undefined ? { file: issue.location.file } : {}),
        line: issue.location.line,
        ...(issue.location.column !== undefined ? { column: issue.location.column } : {}),
      },
      normativeRefs: getNormativeRefs(issue.type),
    }));

    const partial = {
      reportVersion: '1.0' as const,
      generatedAt: new Date().toISOString(),
      analysisId: analysis.analysisId,
      issues,
    };

    const serialized = JSON.stringify(partial, null, 2);
    const integrityHash = sha256(serialized);

    return { ...partial, integrityHash };
  }
}
