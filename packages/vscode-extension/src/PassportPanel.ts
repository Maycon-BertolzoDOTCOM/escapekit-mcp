import * as vscode from 'vscode';
import { GovernanceBridge } from './GovernanceBridge';

export class PassportPanel {
  private static currentPanel: PassportPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.update();
    
    this.panel.onDidDispose(() => PassportPanel.currentPanel = undefined, null);
  }
  
  public static createOrShow(extensionUri: vscode.Uri, filePath: string): void {
    const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;
    
    if (PassportPanel.currentPanel) {
      PassportPanel.currentPanel.panel.reveal(column);
      PassportPanel.currentPanel.update(filePath);
      return;
    }
    
    const panel = vscode.window.createWebviewPanel(
      'codememoriaPassport',
      'CodeMemória Passport',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );
    
    PassportPanel.currentPanel = new PassportPanel(panel, extensionUri);
    PassportPanel.currentPanel.update(filePath);
  }
  
  private async update(filePath?: string): Promise<void> {
    if (!filePath) {
      this.panel.webview.html = this.getLoadingHtml();
      return;
    }
    
    try {
      const passport = await GovernanceBridge.analyzeFile(filePath);
      this.panel.webview.html = this.getWebviewContent(passport);
    } catch (error) {
      this.panel.webview.html = this.getErrorHtml(error instanceof Error ? error.message : String(error));
    }
  }
  
  private getLoadingHtml(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>CodeMemória Passport</title>
      </head>
      <body>
        <h1>Loading analysis...</h1>
      </body>
      </html>
    `;
  }
  
  private getErrorHtml(error: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>CodeMemória Passport</title>
      </head>
      <body>
        <h1>Analysis failed</h1>
        <pre>${error}</pre>
      </body>
      </html>
    `;
  }
  
  private getWebviewContent(passport: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>CodeMemória Passport</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            padding: 20px;
          }
          .risk-${passport.riskLevel} {
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 20px;
          }
          .risk-critical { background-color: #ffebee; border-left: 4px solid #f44336; }
          .risk-high { background-color: #fff3e0; border-left: 4px solid #ff9800; }
          .risk-medium { background-color: #fff8e1; border-left: 4px solid #ffc107; }
          .risk-low { background-color: #e8f5e9; border-left: 4px solid #4caf50; }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid #ddd;
          }
        </style>
      </head>
      <body>
        <h1>CodeMemória Governance Passport</h1>
        
        <div class="risk-${passport.riskLevel}">
          <h2>Risk Level: ${passport.riskLevel.toUpperCase()}</h2>
          <p>Generated at: ${new Date(passport.timestamp).toLocaleString()}</p>
        </div>
        
        <h2>Compliance Stamps</h2>
        <ul>
          ${passport.complianceStamps.map((stamp: any) => 
            `<li>${stamp.name} (${stamp.status})</li>`
          ).join('')}
        </ul>
        
        <h2>Validation Findings</h2>
        <table>
          <thead>
            <tr>
              <th>Rule</th>
              <th>Severity</th>
              <th>Location</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            ${passport.validations.map((validation: any) => 
              `<tr>
                <td>${validation.ruleId}</td>
                <td>${validation.riskLevel}</td>
                <td>Line ${validation.startLine}:${validation.startColumn}</td>
                <td>${validation.message}</td>
              </tr>`
            ).join('')}
          </tbody>
        </table>
        
        <h2>Code Fingerprint</h2>
        <pre>${passport.codeFingerprint.hash}</pre>
      </body>
      </html>
    `;
  }
  
  public dispose(): void {
    PassportPanel.currentPanel = undefined;
    this.panel.dispose();
  }
}