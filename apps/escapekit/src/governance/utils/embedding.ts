import type { CodeFingerprint } from '../types.js';
import { sha256 } from './hash.js';

export interface IEmbeddingGenerator {
  generate(fingerprint: CodeFingerprint): Float32Array; // 384 dims, norma unitária
}

/**
 * Deriva um vetor de 384 dimensões a partir de um CodeFingerprint de forma
 * determinística e não-inversível, usando SHA-256 como função de hash.
 *
 * Algoritmo:
 * 1. Concatenação canônica dos campos do fingerprint
 * 2. Seed expansion: 12 hashes SHA-256 × 32 bytes = 384 valores em [-1, 1]
 * 3. L2 normalization para norma unitária
 */
export class EmbeddingGenerator implements IEmbeddingGenerator {
  generate(fingerprint: CodeFingerprint): Float32Array {
    const { hash, astSignature, dependencies, complexity } = fingerprint;

    // 1. Concatenação canônica
    const input = `${hash}|${astSignature}|${dependencies.slice().sort().join(',')}|${complexity}`;

    // 2. Seed expansion: 384 dimensões via SHA-256 iterado
    const raw = new Float32Array(384);
    for (let i = 0; i < 384; i++) {
      const seedInput = `${input}:${Math.floor(i / 32)}:${i % 32}`;
      const hexDigest = sha256(seedInput);
      // Converte o par hex na posição i % 32 para byte inteiro
      const byteIndex = i % 32;
      const byte = parseInt(hexDigest.slice(byteIndex * 2, byteIndex * 2 + 2), 16);
      raw[i] = (byte - 128) / 128.0;
    }

    // 3. L2 normalization
    let norm = 0;
    for (let i = 0; i < 384; i++) {
      norm += raw[i] * raw[i];
    }
    norm = Math.sqrt(norm);

    const embedding = new Float32Array(384);
    for (let i = 0; i < 384; i++) {
      embedding[i] = raw[i] / norm;
    }

    return embedding;
  }
}
