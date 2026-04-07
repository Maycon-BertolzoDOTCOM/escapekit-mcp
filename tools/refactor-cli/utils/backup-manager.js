import fs from 'fs/promises';
import path from 'path';
import { execa } from 'execa';
import chalk from 'chalk';

/**
 * Sistema de Backup e Gerenciamento de Estado com Checkpoints
 * Princípios de Invariantes: Reversibilidade e Idempotência
 */
export class BackupManager {
  constructor(projectPath = process.cwd(), backupDir = '.escapekit-backups') {
    this.projectPath = projectPath;
    this.backupDir = path.join(projectPath, backupDir);
    this.checkpoints = [];
  }

  // --- Invariante: Backup deve ser sempre reversível ---
  
  /**
   * Cria backup antes de operações destrutivas
   */
  async createBackup(operationId, description = '') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `${operationId}-${timestamp}`;
    const backupPath = path.join(this.backupDir, backupId);

    try {
      await fs.mkdir(backupPath, { recursive: true });
      
      // Backup de arquivos críticos
      const criticalFiles = await this.scanCriticalFiles();
      
      console.log(chalk.blue(`💾 Criando backup: ${backupId}`));
      
      for (const file of criticalFiles) {
        const destPath = path.join(backupPath, file.relativePath);
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.copyFile(file.fullPath, destPath);
      }

      // Registrar checkpoint
      const checkpoint = {
        id: backupId,
        timestamp: new Date(),
        operation: operationId,
        description,
        files: criticalFiles.map(f => f.relativePath),
        location: backupPath
      };
      
      this.checkpoints.push(checkpoint);
      await this.saveCheckpoints();
      
      console.log(chalk.green(`✅ Backup criado: ${backupId} (${criticalFiles.length} arquivos)`));
      return checkpoint;
      
    } catch (error) {
      console.error(chalk.red(`❌ Falha ao criar backup: ${error.message}`));
      throw error;
    }
  }

  /**
   * Cria checkpoint para operações reversíveis
   */
  async createCheckpoint(operationId, metadata = {}) {
    const checkpoint = await this.createBackup(`checkpoint-${operationId}`, metadata.description);
    checkpoint.metadata = metadata;
    
    // Adicionar snapshot do estado atual do Git
    try {
      const gitStatus = await execa('git', ['status', '--porcelain'], { cwd: this.projectPath });
      const gitBranch = await execa('git', ['branch', '--show-current'], { cwd: this.projectPath });
      
      checkpoint.git = {
        branch: gitBranch.stdout.trim(),
        status: gitStatus.stdout.trim()
      };
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Git não disponível para checkpoint: ${operationId}`));
    }
    
    return checkpoint;
  }

  /**
   * Rollback para checkpoint específico
   */
  async rollbackToCheckpoint(checkpointId) {
    const checkpoint = this.checkpoints.find(cp => cp.id === checkpointId);
    
    if (!checkpoint) {
      throw new Error(`Checkpoint não encontrado: ${checkpointId}`);
    }

    console.log(chalk.yellow(`🔄 Executando rollback para: ${checkpointId}`));
    
    try {
      // Restaurar arquivos do backup
      for (const filePath of checkpoint.files) {
        const sourcePath = path.join(checkpoint.location, filePath);
        const destPath = path.join(this.projectPath, filePath);
        
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.copyFile(sourcePath, destPath);
      }
      
      console.log(chalk.green(`✅ Rollback concluído: ${checkpointId}`));
      
      // Remover checkpoint após rollback bem-sucedido
      this.checkpoints = this.checkpoints.filter(cp => cp.id !== checkpointId);
      await this.saveCheckpoints();
      
    } catch (error) {
      console.error(chalk.red(`❌ Falha no rollback: ${error.message}`));
      throw error;
    }
  }

  /**
   * Lista todos os checkpoints disponíveis
   */
  async listCheckpoints() {
    await this.loadCheckpoints();
    return this.checkpoints;
  }

  /**
   * Limpa checkpoints antigos (mantém os N mais recentes)
   */
  async cleanupOldCheckpoints(keepCount = 10) {
    await this.loadCheckpoints();
    
    if (this.checkpoints.length <= keepCount) {
      return;
    }
    
    const toDelete = this.checkpoints.slice(0, -keepCount);
    
    for (const checkpoint of toDelete) {
      try {
        await fs.rm(checkpoint.location, { recursive: true });
        console.log(chalk.gray(`🗑️  Removido backup antigo: ${checkpoint.id}`));
      } catch (error) {
        console.warn(chalk.yellow(`⚠️  Não foi possível remover: ${checkpoint.id}`));
      }
    }
    
    this.checkpoints = this.checkpoints.slice(-keepCount);
    await this.saveCheckpoints();
  }

  // --- Métodos Privados ---

  async scanCriticalFiles() {
    const criticalPatterns = [
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      '*.ts',
      '*.js',
      '*.tsx',
      '*.jsx',
      'src/**/*',
      'tests/**/*',
      '*.md'
    ];

    const files = [];
    
    // Implementação simplificada - em produção usar glob patterns
    const importantFiles = [
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      'README.md'
    ];

    for (const fileName of importantFiles) {
      const fullPath = path.join(this.projectPath, fileName);
      try {
        await fs.access(fullPath);
        files.push({
          relativePath: fileName,
          fullPath
        });
      } catch {
        // Arquivo não existe, pular
      }
    }

    return files;
  }

  async saveCheckpoints() {
    const checkpointsFile = path.join(this.backupDir, 'checkpoints.json');
    const data = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      checkpoints: this.checkpoints
    };
    
    await fs.writeFile(checkpointsFile, JSON.stringify(data, null, 2));
  }

  async loadCheckpoints() {
    const checkpointsFile = path.join(this.backupDir, 'checkpoints.json');
    
    try {
      await fs.access(checkpointsFile);
      const data = JSON.parse(await fs.readFile(checkpointsFile, 'utf8'));
      this.checkpoints = data.checkpoints || [];
    } catch (error) {
      // Arquivo não existe ou é inválido
      this.checkpoints = [];
    }
  }
}