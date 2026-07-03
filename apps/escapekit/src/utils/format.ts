/**
 * Display Formatters
 *
 * Pure display formatters for file sizes, durations, tokens, etc.
 * Inspired by Claude Code's utils/format.ts.
 *
 * Usage:
 *   import { formatFileSize, formatDuration, formatTokens } from './utils/format.js'
 */

import { getRelativeTimeFormat } from './intl.js';

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/**
 * Format file size (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${UNITS[i]}`;
}

/**
 * Format duration in human-readable form (e.g., "2m 30s")
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.round((ms % 60000) / 1000);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(ms / 3600000);
  const mins = Math.round((ms % 3600000) / 60000);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format number with locale separators (e.g., "1,234,567")
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Format token count (e.g., "12.5K tokens")
 */
export function formatTokens(count: number): string {
  if (count < 1000) return `${count}`;
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(date: Date, style: 'long' | 'short' | 'narrow' = 'long'): string {
  const rtf = getRelativeTimeFormat(style, 'auto');
  const now = Date.now();
  const diff = date.getTime() - now;
  const absDiff = Math.abs(diff);

  if (absDiff < 60000) return rtf.format(Math.round(diff / 1000), 'second');
  if (absDiff < 3600000) return rtf.format(Math.round(diff / 60000), 'minute');
  if (absDiff < 86400000) return rtf.format(Math.round(diff / 3600000), 'hour');
  if (absDiff < 604800000) return rtf.format(Math.round(diff / 86400000), 'day');
  return rtf.format(Math.round(diff / 604800000), 'week');
}

/**
 * Format bytes per second (e.g., "1.5 MB/s")
 */
export function formatRate(bytesPerSecond: number): string {
  return `${formatFileSize(bytesPerSecond)}/s`;
}

/**
 * Format percentage (e.g., "75%")
 */
export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}
