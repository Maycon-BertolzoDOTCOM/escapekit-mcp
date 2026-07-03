import { describe, it, expect, vi } from 'vitest';
import { server } from '../../src/server';

describe('server (MCP Server instance)', () => {
  describe('listTools', () => {
    it('should return available tools', () => {
      const tools = server.listTools();
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should include analyze_sandbox_code tool', () => {
      const tools = server.listTools();
      const analyzeTool = tools.find(t => t.name === 'analyze_sandbox_code');
      expect(analyzeTool).toBeDefined();
      expect(analyzeTool?.description).toContain('Analyze');
    });

    it('should include generate_escape_kit tool', () => {
      const tools = server.listTools();
      const generateTool = tools.find(t => t.name === 'generate_escape_kit');
      expect(generateTool).toBeDefined();
      expect(generateTool?.description).toContain('Generate');
    });

    it('should include validate_reality tool', () => {
      const tools = server.listTools();
      const validateTool = tools.find(t => t.name === 'validate_reality');
      expect(validateTool).toBeDefined();
      expect(validateTool?.description).toContain('Validate');
    });
  });
});
