/**
 * Buffered Async Writer
 *
 * Buffers writes and flushes them in batches for performance.
 * Supports overflow handling and immediate mode.
 *
 * Inspired by Claude Code's utils/bufferedWriter.ts.
 *
 * Usage:
 *   import { BufferedWriter } from './utils/bufferedWriter.js'
 *
 *   const writer = new BufferedWriter({
 *     filePath: './output.jsonl',
 *     flushIntervalMs: 1000,
 *     maxBufferSize: 100,
 *   })
 *
 *   writer.write('line 1\n')
 *   writer.write('line 2\n')
 *   // Auto-flushes every 1s or when buffer reaches 100 items
 *
 *   await writer.flush()
 *   await writer.close()
 */

import { appendFileSync } from 'node:fs';
import { createLogger } from '../logger.js';

const logger = createLogger('BufferedWriter');

export interface BufferedWriterOptions {
  /** File path to write to */
  filePath: string;
  /** Flush interval in ms (default: 1000) */
  flushIntervalMs?: number;
  /** Max items in buffer before forced flush (default: 100) */
  maxBufferSize?: number;
  /** Whether to create parent directories (default: true) */
  createDirs?: boolean;
  /** File encoding (default: utf-8) */
  encoding?: BufferEncoding;
}

export class BufferedWriter {
  private buffer: string[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;
  private closed = false;

  private readonly filePath: string;
  private readonly flushIntervalMs: number;
  private readonly maxBufferSize: number;
  private readonly encoding: BufferEncoding;

  private totalWritten = 0;
  private totalFlushed = 0;

  constructor(options: BufferedWriterOptions) {
    this.filePath = options.filePath;
    this.flushIntervalMs = options.flushIntervalMs ?? 1000;
    this.maxBufferSize = options.maxBufferSize ?? 100;
    this.encoding = (options.encoding ?? 'utf-8') as BufferEncoding;

    if (options.createDirs !== false) {
      const { mkdirSync } = require('node:fs');
      const { dirname } = require('node:path');
      mkdirSync(dirname(this.filePath), { recursive: true });
    }

    // Start periodic flush
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);

    // Unref so it doesn't keep the process alive
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  /**
   * Write a string to the buffer.
   * Triggers a flush if buffer exceeds maxBufferSize.
   */
  write(data: string): void {
    if (this.closed) {
      throw new Error('BufferedWriter is closed');
    }

    this.buffer.push(data);
    this.totalWritten++;

    if (this.buffer.length >= this.maxBufferSize) {
      void this.flush();
    }
  }

  /**
   * Write multiple lines at once
   */
  writeMany(lines: string[]): void {
    for (const line of lines) {
      this.write(line);
    }
  }

  /**
   * Flush the buffer to disk
   */
  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;

    this.flushing = true;
    const toWrite = this.buffer.splice(0);

    try {
      appendFileSync(this.filePath, toWrite.join(''), { encoding: this.encoding });
      this.totalFlushed += toWrite.length;
    } catch (error) {
      // Put items back in buffer for retry
      this.buffer = [...toWrite, ...this.buffer];
      logger.error('BufferedWriter flush failed', error);
      throw error;
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Close the writer, flushing remaining data
   */
  async close(): Promise<void> {
    if (this.closed) return;

    this.closed = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();
  }

  /**
   * Get writer statistics
   */
  get stats() {
    return {
      bufferSize: this.buffer.length,
      totalWritten: this.totalWritten,
      totalFlushed: this.totalFlushed,
      isClosed: this.closed,
      isFlushing: this.flushing,
    };
  }
}
