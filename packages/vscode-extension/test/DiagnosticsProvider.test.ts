import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiagnosticsProvider } from '../src/DiagnosticsProvider';
import * as vscode from 'vscode';
import { GovernanceBridge } from '../src/GovernanceBridge';

// Mock dependencies
vi.mock('../src/GovernanceBridge');
vi.mock('vscode');

describe('DiagnosticsProvider', () => {
  let diagnosticsProvider: DiagnosticsProvider;
  
  beforeEach(() => {
    vi.clearAllMocks();
    diagnosticsProvider = new DiagnosticsProvider();
  });

  it('should map validations to diagnostics correctly', async () => {
    const mockDocument = {
      fileName: '/test/file.ts',
      uri: { toString: () => 'file:///test/file.ts' },
      languageId: 'typescript'
    } as unknown as vscode.TextDocument;
    
    const mockPassport = {
      validations: [
        {
          ruleId: 'rule1',
          message: 'Test message',
          riskLevel: 'high',
          startLine: 1,
          startColumn: 1,
          endLine: 1,
          endColumn: 10
        }
      ]
    };
    
    vi.mocked(GovernanceBridge.analyzeFile).mockResolvedValue(mockPassport);
    
    await diagnosticsProvider.updateDiagnostics(mockDocument);
    
    expect(vscode.DiagnosticCollection.prototype.set).toHaveBeenCalled();
    const diagnostics = vi.mocked(vscode.DiagnosticCollection.prototype.set).mock.calls[0][1];
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe('Test message [rule1]');
    expect(diagnostics[0].severity).toBe(vscode.DiagnosticSeverity.Warning);
  });

  it('should clear diagnostics when no validations', async () => {
    const mockDocument = {
      fileName: '/test/file.ts',
      uri: { toString: () => 'file:///test/file.ts' },
      languageId: 'typescript'
    } as unknown as vscode.TextDocument;
    
    const mockPassport = { validations: [] };
    vi.mocked(GovernanceBridge.analyzeFile).mockResolvedValue(mockPassport);
    
    await diagnosticsProvider.updateDiagnostics(mockDocument);
    
    expect(vscode.DiagnosticCollection.prototype.clear).toHaveBeenCalled();
  });

  it('should handle errors by clearing diagnostics', async () => {
    const mockDocument = {
      fileName: '/test/file.ts',
      uri: { toString: () => 'file:///test/file.ts' },
      languageId: 'typescript'
    } as unknown as vscode.TextDocument;
    
    vi.mocked(GovernanceBridge.analyzeFile).mockRejectedValue(new Error('Test error'));
    
    await diagnosticsProvider.updateDiagnostics(mockDocument);
    
    expect(vscode.DiagnosticCollection.prototype.clear).toHaveBeenCalled();
  });
});