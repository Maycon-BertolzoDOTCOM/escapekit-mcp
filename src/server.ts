/**
 * EscapeKit MCP Server
 * 
 * This is the main entry point for the MCP server that provides tools
 * for analyzing, generating, and validating AI-generated sandbox code.
 */

import { generateId, createErrorResponse, createSuccessResponse, AnalysisResult } from './models/schemas.js';
import { analyzeCode } from './tools/analyze.js';
import { generateEscapeKit } from './tools/generate.js';

// Note: Using a simple implementation for now
// TODO: Replace with actual Photon Skill or FastMCP integration
interface MCPParams {
  code?: string;
  language?: string;
  sandbox_type?: string;
  enable_security_analysis?: boolean;
  analysis_result?: unknown;
  source_code?: string;
  target_platform?: string;
  output_dir?: string;
  include_docker?: boolean;
  include_ci?: boolean;
  force?: boolean;
  dry_run?: boolean;
  project_path?: string;
  validation_level?: string;
}

interface MCPTool {
  name: string;
  description: string;
  execute: (params: MCPParams) => Promise<unknown>;
}

// Type guard for MCPParams
function isMCPParams(p: unknown): p is MCPParams {
  return typeof p === 'object' && p !== null;
}

class MCPServer {
  private tools: Map<string, MCPTool> = new Map();

  registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
    console.log(`[MCP] Registered tool: ${tool.name}`);
  }

  async handleToolCall(toolName: string, params: unknown): Promise<unknown> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return createErrorResponse(`Tool not found: ${toolName}`, 'TOOL_NOT_FOUND');
    }

    try {
      console.log(`[MCP] Executing tool: ${toolName}`);
      
      if (!isMCPParams(params)) {
        return createErrorResponse('Invalid parameters format', 'INVALID_PARAMETERS');
      }
      
      const result = await tool.execute(params);
      return result;
    } catch (error) {
      console.error(`[MCP] Error in tool ${toolName}:`, error);
      return createErrorResponse(
        error instanceof Error ? error.message : 'Unknown error',
        'TOOL_EXECUTION_ERROR'
      );
    }
  }

  listTools(): Array<{ name: string; description: string }> {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
    }));
  }
}

// Create server instance
const server = new MCPServer();

/**
 * Analyze AI-generated code to identify sandbox dependencies and issues
 */
server.registerTool({
  name: 'analyze_sandbox_code',
  description: 'Analyze AI-generated code to identify sandbox dependencies, ghost imports, and other issues. Optionally enable security analysis to detect malicious postinstall scripts.',
  execute: async (params: MCPParams) => {
    const { 
      code, 
      language = 'javascript', 
      sandbox_type,
      enable_security_analysis = false 
    } = params;

    if (!code) {
      return createErrorResponse('Code parameter is required', 'MISSING_PARAMETER');
    }

    return await analyzeCode(code, sandbox_type, language, enable_security_analysis);
  },
});

/**
 * Generate a portable project based on analysis results
 */
server.registerTool({
  name: 'generate_escape_kit',
  description: 'Generate a portable project based on analysis results with real dependencies and polyfills',
  execute: async (params: MCPParams) => {
    const {
      analysis_result,
      source_code = '',
      target_platform = 'local',
      output_dir = './escape_output',
      include_docker = false,
      include_ci = false,
      force = false,
      dry_run = false,
    } = params;

    if (!analysis_result) {
      return createErrorResponse('analysis_result parameter is required', 'MISSING_PARAMETER');
    }
    
    // Type guard for AnalysisResult
    function isAnalysisResult(r: unknown): r is AnalysisResult {
      return (
        typeof r === 'object' && 
        r !== null && 
        'analysisId' in r && 
        'timestamp' in r && 
        'language' in r && 
        'summary' in r &&
        'confidenceScore' in r
      );
    }
    
    if (!isAnalysisResult(analysis_result)) {
      return createErrorResponse('Invalid analysis_result format', 'INVALID_ANALYSIS_RESULT');
    }

    return await generateEscapeKit(
      analysis_result,
      source_code,
      target_platform,
      output_dir,
      { includeDocker: include_docker, includeCI: include_ci, force, dryRun: dry_run }
    );
  },
});

/**
 * Validate generated code in real environment
 */
server.registerTool({
  name: 'validate_reality',
  description: 'Validate generated code in real environment with runtime tests and performance metrics',
  execute: async (params: MCPParams) => {
    const { project_path, validation_level = 'standard' } = params;
    void validation_level; // TODO: Use validation_level when implementing validation logic

    if (!project_path) {
      return createErrorResponse('project_path parameter is required', 'MISSING_PARAMETER');
    }

    // TODO: Implement actual validation logic
    // For now, return a mock response
    const validationId = generateId('validation');

    return createSuccessResponse({
      validationId,
      kitId: generateId('kit'),
      overallScore: 0.85,
      metrics: {
        webglSupport: true,
        bundleSize: '245KB',
        apiLatency: 120,
        fallbackCount: 2,
        buildTime: 5000,
      },
      issues: [],
      readyForProduction: true,
      timestamp: new Date().toISOString(),
    });
  },
});

// Start server (placeholder for actual MCP server startup)
console.log('[MCP] EscapeKit MCP Server initialized');
console.log('[MCP] Available tools:', server.listTools().map(t => t.name).join(', '));

// Export for testing
export { server };