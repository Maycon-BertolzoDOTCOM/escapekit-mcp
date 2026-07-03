/**
 * UTF-8 BOM Stripper
 *
 * Removes byte-order mark from strings.
 * Inspired by Claude Code's utils/jsonRead.ts.
 */

/**
 * Strip UTF-8 BOM from a string
 */
export function stripBOM(str: string): string {
  if (str.charCodeAt(0) === 0xFEFF) {
    return str.slice(1);
  }
  return str;
}

/**
 * Strip BOM from a Buffer and return as string
 */
export function stripBOMFromBuffer(buf: Buffer, encoding: BufferEncoding = 'utf-8'): string {
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    return buf.toString(encoding, 3);
  }
  return buf.toString(encoding);
}
