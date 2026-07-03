import { createHash } from 'crypto';

/**
 * Calcula o SHA-256 de uma string e retorna o digest em hexadecimal.
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Calcula o chainHash de uma entrada de auditoria.
 *
 * Fórmula:
 *   SHA-256( (parentHash ?? 'null') + "|" + timestamp.toISOString() + "|" + action + "|" + actor + "|" + inputHash + "|" + resultHash )
 */
export function chainHash(
  parentHash: string | null,
  timestamp: Date,
  action: string,
  actor: string,
  inputHash: string,
  resultHash: string,
): string {
  const payload = [
    parentHash ?? 'null',
    timestamp.toISOString(),
    action,
    actor,
    inputHash,
    resultHash,
  ].join('|');

  return sha256(payload);
}
