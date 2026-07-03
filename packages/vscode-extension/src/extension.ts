import * as vscode from 'vscode';
import { GovernanceBridge } from './GovernanceBridge';
import { DiagnosticsProvider } from './DiagnosticsProvider';
import { StatusBarItem } from './StatusBarItem';

export function activate(context: vscode.ExtensionContext) {
  console.log('CodeMemória Governance extension activated');
  
  const diagnosticsProvider = new DiagnosticsProvider();
  const statusBarItem = new StatusBarItem();
  
  // Register document change listeners
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(document => {
      if (document.languageId === 'typescript' || document.languageId === 'javascript') {
        diagnosticsProvider.updateDiagnostics(document);
        statusBarItem.updateForDocument(document);
      }
    }),
    
    vscode.workspace.onDidOpenTextDocument(document => {
      if (document.languageId === 'typescript' || document.languageId === 'javascript') {
        diagnosticsProvider.updateDiagnostics(document);
        statusBarItem.updateForDocument(document);
      }
    })
  
  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codememoria.analyzeFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active text editor found');
        return;
      }
      
      const timeout = 3000; // 3 second timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Analysis timed out')), timeout)
      );
      
      try {
        const passport = await Promise.race([
          GovernanceBridge.analyzeFile(editor.document.fileName),
          timeoutPromise
        ]);
        
        diagnosticsProvider.updateDiagnostics(editor.document);
        statusBarItem.update(passport.riskLevel);
        PassportPanel.createOrShow(context.extensionUri, editor.document.fileName);
        
      } catch (error) {
        const message = `Analysis failed: ${error instanceof Error ? error.message : String(error)}`;
        vscode.window.showErrorMessage(message, { modal: false });
        statusBarItem.update('error');
      }
    })
  );
  
  context.subscriptions.push(diagnosticsProvider);
}

export function deactivate() {}
