import * as vscode from 'vscode';
import { GovernanceBridge } from './GovernanceBridge';

export class StatusBarItem {
  private statusBarItem: vscode.StatusBarItem;
  private currentRiskLevel: string | null = null;
  
  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'codememoria.analyzeFile';
    this.update('unknown');
    this.statusBarItem.show();
  }
  
  public async updateForDocument(document: vscode.TextDocument): Promise<void> {
    try {
      const passport = await GovernanceBridge.analyzeFile(document.fileName);
      this.update(passport.riskLevel);
    } catch (error) {
      this.update('error');
    }
  }
  
  public update(riskLevel: string): void {
    this.currentRiskLevel = riskLevel;
    
    let text = `CodeMemória: ${riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}`;
    let color = '#cccccc';
    
    switch (riskLevel) {
      case 'critical': color = '#ff0000'; break;
      case 'high': color = '#ff9900'; break;
      case 'medium': color = '#ffff00'; break;
      case 'low': color = '#00ff00'; break;
      case 'error': text = 'CodeMemória: Error'; color = '#ff0000'; break;
      default: text = 'CodeMemória: Unknown'; break;
    }
    
    this.statusBarItem.text = `$(shield) ${text}`;
    this.statusBarItem.color = color;
    this.statusBarItem.tooltip = 'Click to run CodeMemória analysis';
  }
  
  public dispose(): void {
    this.statusBarItem.dispose();
  }
}