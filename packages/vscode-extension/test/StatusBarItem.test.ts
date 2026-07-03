import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusBarItem } from '../src/StatusBarItem';
import { GovernanceBridge } from '../src/GovernanceBridge';
import * as vscode from 'vscode';

// Mock dependencies
vi.mock('../src/GovernanceBridge');
vi.mock('vscode');

describe('StatusBarItem', () => {
  let statusBarItem: StatusBarItem;
  
  beforeEach(() => {
    vi.clearAllMocks();
    statusBarItem = new StatusBarItem();
  });

  it('should update status bar with risk level', async () => {
    const mockDocument = {
      fileName: '/test/file.ts'
    } as unknown as vscode.TextDocument;
    
    const mockPassport = { riskLevel: 'high' };
    vi.mocked(GovernanceBridge.analyzeFile).mockResolvedValue(mockPassport);
    
    await statusBarItem.updateForDocument(mockDocument);
    
    expect(vscode.StatusBarItem.prototype.text).toBe('$(shield) High');
    expect(vscode.StatusBarItem.prototype.color).toBe('#ff9900');
  });

  it('should show error state when analysis fails', async () => {
    const mockDocument = {
      fileName: '/test/file.ts'
    } as unknown as vscode.TextDocument;
    
    vi.mocked(GovernanceBridge.analyzeFile).mockRejectedValue(new Error('Test error'));
    
    await statusBarItem.updateForDocument(mockDocument);
    
    expect(vscode.StatusBarItem.prototype.text).toBe('$(shield) CodeMemória: Error');
    expect(vscode.StatusBarItem.prototype.color).toBe('#ff0000');
  });
});