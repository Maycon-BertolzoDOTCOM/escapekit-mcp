import * as vscode from 'vscode';
import { GovernanceBridge } from './GovernanceBridge';

export class DiagnosticsProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;
  
  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('codememoria');
  }
  
  public async updateDiagnostics(document: vscode.TextDocument): Promise<void> {
    try {
      const passport = await GovernanceBridge.analyzeFile(document.fileName);
      
      if (!passport.validations || passport.validations.length === 0) {
        this.diagnosticCollection.clear();
        return;
      }
      
      const diagnostics = passport.validations.map(validation => {
        const range = new vscode.Range(
          new vscode.Position(validation.startLine - 1, validation.startColumn - 1),
          new vscode.Position(validation.endLine - 1, validation.endColumn - 1)
        );
        
        const diagnostic = new vscode.Diagnostic(
          range,
          `${validation.message} [${validation.ruleId}]`,
          this.getDiagnosticSeverity(validation.riskLevel)
        );
        
        diagnostic.source = 'CodeMemória';
        diagnostic.code = validation.ruleId;
        
        return diagnostic;
      });
      
      this.diagnosticCollection.set(document.uri, diagnostics);
    } catch (error) {
      this.diagnosticCollection.clear();
    }
  }
  
  private getDiagnosticSeverity(riskLevel: string): vscode.DiagnosticSeverity {
    switch (riskLevel) {
      case 'critical': return vscode.DiagnosticSeverity.Error;
      case 'high': return vscode.DiagnosticSeverity.Warning;
      case 'medium': return vscode.DiagnosticSeverity.Information;
      default: return vscode.DiagnosticSeverity.Hint;
    }
  }
  
  public dispose(): void {
    this.diagnosticCollection.dispose();
  }
}