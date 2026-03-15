/**
 * Utilitários de sistema de arquivos
 */

import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Gera citekey a partir de título
 */
export function generateCitekey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s:-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

/**
 * Garante que diretório existe
 */
export function ensureDirectory(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Verifica se arquivo existe
 */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

/**
 * Lê todos os arquivos YAML de um diretório
 */
export function readYamlFiles(dirPath: string): string[] {
  const fs = require('fs') as typeof import('fs');
  
  if (!existsSync(dirPath)) {
    return [];
  }
  
  const files = fs.readdirSync(dirPath);
  return files
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    .map(f => join(dirPath, f));
}

/**
 * Extrai citekey do nome do arquivo
 */
export function extractCitekey(filename: string): string {
  return filename.replace(/\.(yaml|yml)$/, '');
}
