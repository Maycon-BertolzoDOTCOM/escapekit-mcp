/**
 * MirrorRegistry - Chinese mirror configuration and fallback logic (自主创新)
 * Prioritizes Chinese mirrors (npmmirror.com) with fallback to global registry.
 */
import { logger } from '../logger.js';

export interface MirrorConfig {
  name: string;
  url: string;
  priority: number;
  timeout: number;
}

export interface MirrorRegistryOptions {
  /** Enable Chinese mirrors (default: true) */
  enableChineseMirrors?: boolean;
  /** Enable offline mode (default: false) */
  offlineMode?: boolean;
  /** Custom mirrors to add */
  customMirrors?: MirrorConfig[];
}

export const DEFAULT_MIRRORS: MirrorConfig[] = [
  { name: 'npmmirror', url: 'https://registry.npmmirror.com', priority: 1, timeout: 5000 },
  { name: 'taobao', url: 'https://registry.npm.taobao.org', priority: 2, timeout: 5000 },
  { name: 'npmjs', url: 'https://registry.npmjs.org', priority: 3, timeout: 10000 },
];

export class MirrorRegistry {
  private readonly log = logger.child('MirrorRegistry');
  private readonly mirrors: MirrorConfig[];
  private readonly offlineMode: boolean;

  constructor(options: MirrorRegistryOptions = {}) {
    const { enableChineseMirrors = true, offlineMode = false, customMirrors = [] } = options;
    this.offlineMode = offlineMode;

    const baseMirrors = enableChineseMirrors
      ? DEFAULT_MIRRORS
      : DEFAULT_MIRRORS.filter(m => m.name === 'npmjs');

    this.mirrors = [...baseMirrors, ...customMirrors]
      .sort((a, b) => a.priority - b.priority);

    this.log.debug('MirrorRegistry initialized', { mirrors: this.mirrors.map(m => m.name), offlineMode });
  }

  /** Get ordered list of mirrors to try */
  getMirrors(): MirrorConfig[] {
    return [...this.mirrors];
  }

  /** Fetch from mirrors with sequential fallback */
  async fetch(path: string, options: RequestInit = {}): Promise<{ response: Response; mirror: MirrorConfig }> {
    if (this.offlineMode) {
      throw new Error('Offline mode: network requests disabled');
    }

    let lastError: Error | undefined;

    for (const mirror of this.mirrors) {
      const url = `${mirror.url}/${path}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), mirror.timeout);

      try {
        this.log.debug('Trying mirror', { mirror: mirror.name, url });
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok || response.status === 404) {
          this.log.debug('Mirror responded', { mirror: mirror.name, status: response.status });
          return { response, mirror };
        }

        lastError = new Error(`Mirror ${mirror.name} returned ${response.status}`);
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err instanceof Error ? err : new Error(String(err));
        this.log.warn('Mirror failed, trying next', { mirror: mirror.name, error: lastError.message });
      }
    }

    throw lastError ?? new Error('All mirrors failed');
  }

  /** Check if a specific mirror is reachable */
  async checkMirror(mirrorName: string): Promise<boolean> {
    const mirror = this.mirrors.find(m => m.name === mirrorName);
    if (!mirror) return false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), mirror.timeout);
      const response = await fetch(mirror.url, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}
