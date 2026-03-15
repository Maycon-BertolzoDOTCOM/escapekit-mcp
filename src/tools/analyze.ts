/**
 * Analyze tool for MCP server
 * 
 * Provides the analyze_sandbox_code functionality
 */

import { createSuccessResponse, createErrorResponse } from '../models/schemas.js';
import { CodeAnalyzer } from '../analyzers/CodeAnalyzer.js';

const analyzer = new CodeAnalyzer();

export async function analyzeCode(
  code: string,
  sandboxType?: string,
  targetRuntime = 'javascript',
  enableSecurityAnalysis = false
) {
  if (!code) {
    return createErrorResponse('Code parameter is required', 'MISSING_PARAMETER');
  }

  try {
    const result = await analyzer.analyze(code, {
      sandboxType,
      language: targetRuntime,
      checkNPMRegistry: true,
      enableSecurityAnalysis,
    });

    return createSuccessResponse(result);
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error during analysis',
      'ANALYSIS_ERROR'
    );
  }
}
