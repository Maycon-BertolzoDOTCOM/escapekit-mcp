import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

/**
 * Sistema de Tracking de Progresso e Histórico de Operações
 * Princípios de Invariantes: Traceabilidade e Reprodutibilidade
 */
export class ProgressTracker {
  constructor(projectPath = process.cwd(), logsDir = '.escapekit-logs') {
    this.projectPath = projectPath;
    this.logsDir = path.join(projectPath, logsDir);
    this.currentSession = null;
    this.operations = [];
  }

  /**
   * Inicia uma nova sessão de trabalho
   */
  async startSession(sessionId, metadata = {}) {
    const session = {
      id: sessionId,
      startTime: new Date(),
      metadata,
      operations: [],
      state: 'running'
    };

    this.currentSession = session;
    
    await this.ensureLogsDir();
    await this.saveSession(session);
    
    console.log(chalk.blue(`📊 Iniciando sessão: ${sessionId}`));
    return session;
  }

  /**
   * Registra uma operação na sessão atual
   */
  async logOperation(operationId, type, status, details = {}) {
    if (!this.currentSession) {
      throw new Error('Nenhuma sessão ativa. Use startSession() primeiro.');
    }

    const operation = {
      id: operationId,
      type,
      status,
      timestamp: new Date(),
      duration: details.duration || 0,
      details
    };

    this.currentSession.operations.push(operation);
    this.operations.push(operation);

    // Log em tempo real
    const icon = this.getStatusIcon(status);
    const color = this.getStatusColor(status);
    console.log(chalk[color](`${icon} ${type}: ${operationId} - ${status}`));

    await this.saveOperation(operation);
    return operation;
  }

  /**
   * Finaliza a sessão atual
   */
  async endSession(finalStatus = 'completed', summary = {}) {
    if (!this.currentSession) {
      throw new Error('Nenhuma sessão ativa.');
    }

    this.currentSession.endTime = new Date();
    this.currentSession.state = finalStatus;
    this.currentSession.summary = summary;

    const duration = this.currentSession.endTime - this.currentSession.startTime;
    this.currentSession.duration = duration;

    await this.saveSession(this.currentSession, true);
    
    console.log(chalk.green(`✅ Sessão finalizada: ${this.currentSession.id} (${this.formatDuration(duration)})`));
    
    const finalSession = this.currentSession;
    this.currentSession = null;
    
    return finalSession;
  }

  /**
   * Gera relatório de progresso
   */
  async generateProgressReport(options = {}) {
    const sessions = await this.loadAllSessions();
    
    const report = {
      generatedAt: new Date().toISOString(),
      totalSessions: sessions.length,
      sessions: sessions.map(session => ({
        id: session.id,
        state: session.state,
        startTime: session.startTime,
        duration: session.duration || 0,
        operations: session.operations?.length || 0,
        successCount: session.operations?.filter(op => op.status === 'success').length || 0,
        failureCount: session.operations?.filter(op => op.status === 'failed').length || 0
      }))
    };

    if (options.format === 'json') {
      return JSON.stringify(report, null, 2);
    }

    // Formato de tabela
    return this.formatReportAsTable(report);
  }

  /**
   * Verifica progresso baseado em critérios específicos
   */
  async checkProgression(criteria = {}) {
    const sessions = await this.loadAllSessions();
    
    const progression = {
      totalOperations: this.operations.length,
      successRate: this.calculateSuccessRate(),
      averageDuration: this.calculateAverageDuration(),
      recentTrend: this.analyzeRecentTrend(),
      milestoneProgress: this.checkMilestones(criteria.milestones)
    };

    return progression;
  }

  /**
   * Exporta histórico para análise externa
   */
  async exportHistory(format = 'json', outputPath = null) {
    const sessions = await this.loadAllSessions();
    const exportData = {
      exportVersion: '1.0',
      exportDate: new Date().toISOString(),
      sessions
    };

    let content;
    if (format === 'json') {
      content = JSON.stringify(exportData, null, 2);
    } else if (format === 'csv') {
      content = this.convertToCSV(exportData);
    }

    if (outputPath) {
      await fs.writeFile(outputPath, content);
      console.log(chalk.green(`📤 Histórico exportado para: ${outputPath}`));
    }

    return content;
  }

  // --- Métodos Auxiliares ---

  getStatusIcon(status) {
    const icons = {
      'running': '🔄',
      'success': '✅',
      'failed': '❌',
      'warning': '⚠️',
      'skipped': '⏭️'
    };
    return icons[status] || '📝';
  }

  getStatusColor(status) {
    const colors = {
      'running': 'blue',
      'success': 'green',
      'failed': 'red',
      'warning': 'yellow',
      'skipped': 'gray'
    };
    return colors[status] || 'white';
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  calculateSuccessRate() {
    if (this.operations.length === 0) return 100;
    
    const successCount = this.operations.filter(op => op.status === 'success').length;
    return (successCount / this.operations.length) * 100;
  }

  calculateAverageDuration() {
    if (this.operations.length === 0) return 0;
    
    const totalDuration = this.operations.reduce((sum, op) => sum + (op.duration || 0), 0);
    return totalDuration / this.operations.length;
  }

  analyzeRecentTrend() {
    if (this.operations.length < 5) return 'insufficient-data';
    
    const recent = this.operations.slice(-10);
    const successCount = recent.filter(op => op.status === 'success').length;
    
    if (successCount === recent.length) return 'excellent';
    if (successCount >= recent.length * 0.8) return 'good';
    if (successCount >= recent.length * 0.6) return 'fair';
    return 'needs-improvement';
  }

  checkMilestones(milestones = []) {
    return milestones.map(milestone => ({
      ...milestone,
      achieved: this.isMilestoneAchieved(milestone),
      progress: this.calculateMilestoneProgress(milestone)
    }));
  }

  isMilestoneAchieved(milestone) {
    // Implementar lógica de verificação de marcos
    return false;
  }

  calculateMilestoneProgress(milestone) {
    // Implementar cálculo de progresso
    return 0;
  }

  // --- Métodos de Persistência ---

  async ensureLogsDir() {
    await fs.mkdir(this.logsDir, { recursive: true });
  }

  async saveSession(session, isFinal = false) {
    const sessionFile = path.join(this.logsDir, `session-${session.id}.json`);
    await fs.writeFile(sessionFile, JSON.stringify(session, null, 2));
    
    if (isFinal) {
      // Adicionar ao índice de sessões
      await this.updateSessionsIndex(session);
    }
  }

  async saveOperation(operation) {
    const operationsFile = path.join(this.logsDir, 'operations.jsonl');
    const line = JSON.stringify(operation) + '\n';
    await fs.appendFile(operationsFile, line);
  }

  async loadAllSessions() {
    const sessions = [];
    
    try {
      const files = await fs.readdir(this.logsDir);
      const sessionFiles = files.filter(f => f.startsWith('session-') && f.endsWith('.json'));
      
      for (const file of sessionFiles) {
        const content = await fs.readFile(path.join(this.logsDir, file), 'utf8');
        sessions.push(JSON.parse(content));
      }
    } catch (error) {
      // Diretório não existe ou vazio
    }
    
    return sessions.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  }

  async updateSessionsIndex(session) {
    const indexFile = path.join(this.logsDir, 'sessions-index.json');
    let index = [];
    
    try {
      const content = await fs.readFile(indexFile, 'utf8');
      index = JSON.parse(content);
    } catch {
      // Arquivo não existe
    }
    
    index.push({
      id: session.id,
      startTime: session.startTime,
      endTime: session.endTime,
      state: session.state,
      operationsCount: session.operations?.length || 0
    });
    
    await fs.writeFile(indexFile, JSON.stringify(index, null, 2));
  }

  formatReportAsTable(report) {
    let output = `Progress Report - Generated: ${report.generatedAt}\n`;
    output += `Total Sessions: ${report.totalSessions}\n\n`;
    
    output += 'Session ID | Status | Duration | Operations | Success Rate\n';
    output += '----------|--------|----------|------------|-------------\n';
    
    for (const session of report.sessions) {
      const successRate = session.operations > 0 
        ? ((session.successCount / session.operations) * 100).toFixed(1) + '%'
        : 'N/A';
      
      output += `${session.id} | ${session.state} | ${this.formatDuration(session.duration)} | ${session.operations} | ${successRate}\n`;
    }
    
    return output;
  }

  convertToCSV(data) {
    // Implementação simplificada de conversão para CSV
    let csv = 'session_id,state,start_time,duration,operations,success_count,failure_count\n';
    
    for (const session of data.sessions) {
      csv += `"${session.id}","${session.state}","${session.startTime}","${session.duration}","${session.operations}","${session.successCount}","${session.failureCount}"\n`;
    }
    
    return csv;
  }
}