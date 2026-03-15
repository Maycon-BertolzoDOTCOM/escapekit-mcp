/**
 * Source Resolver
 * Extrai metadados de diferentes fontes (DOI, arXiv, PDF local)
 */

import axios from 'axios';
import { parseStringPromise } from 'xml2js';

export interface SourceMetadata {
  title: string;
  authors?: string;
  year?: number;
  abstract?: string;
  url: string;
  doi?: string;
  sourceType: 'doi' | 'arxiv' | 'pdf' | 'url';
  fullText?: string;
}

export class SourceResolver {
  /**
   * Resolve uma fonte e extrai metadados
   */
  async resolve(source: string): Promise<SourceMetadata> {
    // Detecta tipo de fonte
    if (source.startsWith('http://') || source.startsWith('https://')) {
      return this.resolveFromUrl(source);
    } else if (source.endsWith('.pdf')) {
      return this.resolveFromPdf(source);
    } else {
      // Assume DOI
      return this.resolveFromDoi(source);
    }
  }

  /**
   * Extrai DOI de diferentes formatos
   */
  private extractDoi(input: string): string | null {
    // Já é DOI
    if (input.startsWith('10.')) {
      return input;
    }
    
    // URL DOI.org
    const doiUrlMatch = input.match(/doi\.org\/(10\.[^/]+\/.+)/);
    if (doiUrlMatch) {
      return doiUrlMatch[1];
    }
    
    // arXiv URL
    const arxivMatch = input.match(/arxiv\.org\/(abs|pdf)\/([0-9]+\.[0-9]+)/);
    if (arxivMatch) {
      return `arXiv:${arxivMatch[2]}`;
    }
    
    return null;
  }

  /**
   * Resolve a partir de DOI
   */
  private async resolveFromDoi(doi: string): Promise<SourceMetadata> {
    const cleanDoi = this.extractDoi(doi) || doi;
    
    // arXiv
    if (cleanDoi.startsWith('arXiv:')) {
      return this.resolveFromArxiv(cleanDoi.replace('arXiv:', ''));
    }
    
    // Crossref
    const url = `https://api.crossref.org/works/${cleanDoi}`;
    const response = await axios.get(url);
    
    if (response.data.status !== 'ok') {
      throw new Error(`Crossref não retornou dados válidos para DOI: ${cleanDoi}`);
    }
    
    const message = response.data.message;
    
    return {
      title: message.title?.[0] || 'No title',
      authors: message.author?.map((a: any) => `${a.family}, ${a.given}`).join('; ') || '',
      year: message.created?.['date-parts']?.[0]?.[0],
      abstract: message.abstract || '',
      url: `https://doi.org/${cleanDoi}`,
      doi: cleanDoi,
      sourceType: 'doi',
    };
  }

  /**
   * Resolve a partir de arXiv
   */
  private async resolveFromArxiv(arxivId: string): Promise<SourceMetadata> {
    const url = `http://export.arxiv.org/api/query?id_list=${arxivId}`;
    const response = await axios.get(url);
    
    const xml = await parseStringPromise(response.data);
    const entry = xml.feed?.entry?.[0];
    
    if (!entry) {
      throw new Error(`arXiv não retornou dados para ID: ${arxivId}`);
    }
    
    const title = entry.title?.[0]?.trim() || 'No title';
    const authors = entry.author?.map((a: any) => a.name?.[0]).join('; ') || '';
    const published = entry.published?.[0] || '';
    const year = published ? parseInt(published.substring(0, 4)) : undefined;
    const summary = entry.summary?.[0]?.trim() || '';
    
    return {
      title,
      authors,
      year,
      abstract: summary,
      url: `https://arxiv.org/abs/${arxivId}`,
      doi: `arXiv:${arxivId}`,
      sourceType: 'arxiv',
    };
  }

  /**
   * Resolve a partir de URL genérica
   */
  private async resolveFromUrl(url: string): Promise<SourceMetadata> {
    const doi = this.extractDoi(url);
    
    if (doi) {
      return this.resolveFromDoi(doi);
    }
    
    // Tenta extrair título da página
    try {
      const response = await axios.get(url);
      const titleMatch = response.data.match(/<title>([^<]*)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : 'Unknown Title';
      
      return {
        title,
        url,
        sourceType: 'url',
      };
    } catch (error) {
      throw new Error(`Não foi possível extrair metadados da URL: ${url}`);
    }
  }

  /**
   * Resolve a partir de PDF local
   */
  private async resolveFromPdf(pdfPath: string): Promise<SourceMetadata> {
    // PDF parsing será implementado com pdf-parse
    // Por enquanto, retorna metadados básicos
    const pdfParse = await import('pdf-parse');
    const fs = await import('fs/promises');
    
    const dataBuffer = await fs.readFile(pdfPath);
    const data = await pdfParse.default(dataBuffer);
    
    // Tenta extrair título da primeira página
    const firstPageText = data.text.substring(0, 1000);
    const lines = firstPageText.split('\n').filter((l: string) => l.trim().length > 0);
    const title = lines[0] || 'Unknown Title';
    
    return {
      title,
      url: `file://${pdfPath}`,
      sourceType: 'pdf',
      fullText: data.text,
    };
  }
}
