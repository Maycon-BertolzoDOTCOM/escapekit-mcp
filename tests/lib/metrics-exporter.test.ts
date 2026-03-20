import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from '../../scripts/metrics-exporter';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  const sampleLogLine = JSON.stringify({
    event: 'upload_complete',
    timestamp: '2026-03-19T23:00:00Z',
    duration: 3200,
    framework: 'vitest',
    file: 'results.json',
    stats: {
      total: 100,
      passed: 80,
      failed: 10,
      skipped: 10,
      uploaded: 95,
      errors: 0,
      notFound: 5,
      passRate: '80.0%',
    },
  });

  describe('ingestLogLine', () => {
    it('should parse a valid upload_complete event', () => {
      collector.ingestLogLine(sampleLogLine);
      expect(collector.getCount()).toBe(1);
    });

    it('should ignore non-JSON lines', () => {
      collector.ingestLogLine('not json');
      expect(collector.getCount()).toBe(0);
    });

    it('should ignore non-upload events', () => {
      collector.ingestLogLine(JSON.stringify({ event: 'other' }));
      expect(collector.getCount()).toBe(0);
    });
  });

  describe('toPrometheusText', () => {
    it('should return placeholder when no data', () => {
      const text = collector.toPrometheusText();
      expect(text).toContain('# No metrics available');
    });

    it('should generate valid Prometheus format', () => {
      collector.ingestLogLine(sampleLogLine);
      const text = collector.toPrometheusText();

      // Check required Prometheus elements
      expect(text).toContain('# HELP escapekit_upload_total');
      expect(text).toContain('# TYPE escapekit_upload_total counter');
      expect(text).toContain('escapekit_upload_total{framework="vitest"} 100');

      expect(text).toContain('# HELP escapekit_pass_rate');
      expect(text).toContain('# TYPE escapekit_pass_rate gauge');
      expect(text).toContain('escapekit_pass_rate{framework="vitest"} 80');

      expect(text).toContain('# HELP escapekit_upload_duration_seconds');
      expect(text).toContain('# TYPE escapekit_upload_duration_seconds histogram');
      expect(text).toContain('escapekit_upload_duration_seconds_bucket{le="5"}');
      expect(text).toContain('escapekit_upload_duration_seconds_sum 3.2');
      expect(text).toContain('escapekit_upload_duration_seconds_count 1');
    });

    it('should include timestamp', () => {
      collector.ingestLogLine(sampleLogLine);
      const text = collector.toPrometheusText();
      // 2026-03-19T23:00:00Z = 1773961200
      expect(text).toContain('escapekit_last_run_timestamp_seconds');
    });

    it('should include all test outcome counters', () => {
      collector.ingestLogLine(sampleLogLine);
      const text = collector.toPrometheusText();

      expect(text).toContain('escapekit_tests_passed');
      expect(text).toContain('escapekit_tests_failed');
      expect(text).toContain('escapekit_tests_skipped');
      expect(text).toContain('escapekit_tests_not_found');
      expect(text).toContain('escapekit_upload_success');
      expect(text).toContain('escapekit_upload_errors');
    });
  });

  describe('getLatest', () => {
    it('should return null when no data', () => {
      expect(collector.getLatest()).toBeNull();
    });

    it('should return latest snapshot', () => {
      collector.ingestLogLine(sampleLogLine);
      const latest = collector.getLatest();

      expect(latest).not.toBeNull();
      expect(latest!.framework).toBe('vitest');
      expect(latest!.upload_total).toBe(100);
      expect(latest!.test_passed).toBe(80);
      expect(latest!.test_failed).toBe(10);
      expect(latest!.pass_rate).toBe(80);
      expect(latest!.duration_seconds).toBe(3.2);
    });
  });

  describe('multiple ingestions', () => {
    it('should keep only the latest snapshot for Prometheus output', () => {
      const old = JSON.stringify({
        event: 'upload_complete',
        timestamp: '2026-03-18T10:00:00Z',
        duration: 1000,
        framework: 'jest',
        stats: {
          total: 50,
          passed: 40,
          failed: 5,
          skipped: 5,
          uploaded: 50,
          errors: 0,
          notFound: 0,
          passRate: '80%',
        },
      });

      collector.ingestLogLine(old);
      collector.ingestLogLine(sampleLogLine);

      expect(collector.getCount()).toBe(2);
      expect(collector.getLatest()!.framework).toBe('vitest');

      const text = collector.toPrometheusText();
      expect(text).toContain('framework="vitest"');
    });
  });
});
