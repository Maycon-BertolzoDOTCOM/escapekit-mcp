/**
 * Session Management
 *
 * Tracks analysis sessions with persistent JSONL transcripts,
 * enabling resume of interrupted work.
 *
 * Inspired by Claude Code's session persistence (switchSession, JSONL transcripts).
 *
 * Usage:
 *   import { Session } from './session/index.js'
 *
 *   const session = new Session('/path/to/project')
 *   await session.start()
 *
 *   // Record operations
 *   await session.record({ type: 'analysis', input: 'code...', output: result })
 *   await session.record({ type: 'validation', output: issues })
 *
 *   // Resume from transcript
 *   const transcript = await session.loadTranscript()
 *
 *   // Get session metadata
 *   const meta = session.getMeta()
 */

import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createSessionId, type SessionId } from '../types/ids.js';
import { createLogger } from '../logger.js';

/**
 * A single entry in the session transcript
 */
export interface SessionMessage {
  /** Message type */
  type: string;
  /** ISO timestamp */
  timestamp: string;
  /** Input data (optional) */
  input?: unknown;
  /** Output data (optional) */
  output?: unknown;
  /** Duration in ms (optional) */
  durationMs?: number;
  /** Error info (optional) */
  error?: { name: string; message: string };
  /** Arbitrary metadata */
  meta?: Record<string, unknown>;
}

/**
 * Session metadata
 */
export interface SessionMeta {
  sessionId: SessionId;
  projectDir: string;
  createdAt: string;
  transcriptPath: string;
  messageCount: number;
}

/**
 * Session class — manages a single analysis session
 */
export class Session {
  public readonly id: SessionId;
  public readonly projectDir: string;
  public readonly createdAt: number;
  public readonly transcriptPath: string;

  private messageCount = 0;
  private readonly logger = createLogger('Session');

  constructor(projectDir: string, existingId?: SessionId) {
    this.id = existingId ?? createSessionId();
    this.projectDir = resolve(projectDir);
    this.createdAt = Date.now();
    this.transcriptPath = join(this.projectDir, `${this.id}.jsonl`);
  }

  /**
   * Initialize the session — creates transcript file
   */
  async start(): Promise<void> {
    // Ensure directory exists
    mkdirSync(this.projectDir, { recursive: true });

    // Write session header
    const header: SessionMessage = {
      type: 'session_start',
      timestamp: new Date().toISOString(),
      meta: {
        sessionId: this.id,
        projectDir: this.projectDir,
        nodeVersion: process.version,
        platform: process.platform,
      },
    };

    this._writeLine(header);
    this.logger.info(`Session started: ${this.id}`, { projectDir: this.projectDir });
  }

  /**
   * Record a message to the session transcript
   */
  async record(message: Omit<SessionMessage, 'timestamp'> & { timestamp?: string }): Promise<void> {
    const entry: SessionMessage = {
      ...message,
      timestamp: message.timestamp ?? new Date().toISOString(),
    };

    this._writeLine(entry);
    this.messageCount++;
  }

  /**
   * Load the full transcript from disk
   */
  loadTranscript(): SessionMessage[] {
    if (!existsSync(this.transcriptPath)) {
      return [];
    }

    const content = readFileSync(this.transcriptPath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);

    return lines.map((line) => {
      try {
        return JSON.parse(line) as SessionMessage;
      } catch {
        return { type: 'corrupt', timestamp: new Date().toISOString() };
      }
    });
  }

  /**
   * Get session metadata
   */
  getMeta(): SessionMeta {
    return {
      sessionId: this.id,
      projectDir: this.projectDir,
      createdAt: new Date(this.createdAt).toISOString(),
      transcriptPath: this.transcriptPath,
      messageCount: this.messageCount,
    };
  }

  /**
   * Check if a session transcript exists for a given ID
   */
  static exists(projectDir: string, sessionId: SessionId): boolean {
    const path = join(resolve(projectDir), `${sessionId}.jsonl`);
    return existsSync(path);
  }

  /**
   * Load an existing session by ID (without creating new transcript)
   */
  static fromExisting(projectDir: string, sessionId: SessionId): Session {
    const session = new Session(projectDir, sessionId);
    const transcript = session.loadTranscript();
    session.messageCount = transcript.length;
    return session;
  }

  /**
   * List all sessions in a project directory
   */
  static listSessions(projectDir: string): Array<{ id: SessionId; createdAt: string; messageCount: number }> {
    const { readdirSync } = require('node:fs');
    const dir = resolve(projectDir);

    if (!existsSync(dir)) return [];

    const files = readdirSync(dir).filter((f: string) => f.endsWith('.jsonl'));

    return files.map((file: string) => {
      const id = file.replace('.jsonl', '') as SessionId;
      const session = Session.fromExisting(projectDir, id);
      return {
        id,
        createdAt: new Date(session.createdAt).toISOString(),
        messageCount: session.messageCount,
      };
    });
  }

  private _writeLine(entry: SessionMessage): void {
    const line = JSON.stringify(entry) + '\n';
    appendFileSync(this.transcriptPath, line, 'utf-8');
  }
}

/**
 * Create a new session with timing helper
 */
export async function withSession<T>(
  projectDir: string,
  operation: (session: Session) => Promise<T>,
): Promise<T> {
  const session = new Session(projectDir);
  await session.start();
  const startTime = Date.now();

  try {
    const result = await operation(session);
    await session.record({
      type: 'session_end',
      durationMs: Date.now() - startTime,
      meta: { success: true },
    });
    return result;
  } catch (error) {
    await session.record({
      type: 'session_end',
      durationMs: Date.now() - startTime,
      error: {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
      },
      meta: { success: false },
    });
    throw error;
  }
}
