import { describe, it, expect, vi } from 'vitest';
import { SecurityValidator } from '../../src/validators/SecurityValidator';

describe('SecurityValidator (Expanded Tests)', () => {
  describe('SSRF validation', () => {
    it('should detect internal IP addresses in URLs', () => {
      const validator = new SecurityValidator();
      expect(validator.validateUrl('http://192.168.1.1/api')).toBe(false);
      expect(validator.validateUrl('http://10.0.0.1/data')).toBe(false);
      expect(validator.validateUrl('http://127.0.0.1:3000')).toBe(false);
    });

    it('should allow public domain URLs', () => {
      const validator = new SecurityValidator();
      expect(validator.validateUrl('https://api.example.com/data')).toBe(true);
      expect(validator.validateUrl('http://public-service.com/api')).toBe(true);
    });

    it('should validate URL schemes correctly', () => {
      const validator = new SecurityValidator();
      expect(validator.validateUrl('ftp://malicious.com')).toBe(false);
      expect(validator.validateUrl('file:///etc/passwd')).toBe(false);
      expect(validator.validateUrl('https://safe.com')).toBe(true);
    });
  });

  describe('XSS detection', () => {
    it('should detect script tags in input', () => {
      const validator = new SecurityValidator();
      expect(validator.detectXSS('<script>alert(1)</script>')).toBe(true);
      expect(validator.detectXSS('normal text')).toBe(false);
    });

    it('should detect JavaScript protocol in URLs', () => {
      const validator = new SecurityValidator();
      expect(validator.detectXSS('javascript:alert(1)')).toBe(true);
      expect(validator.detectXSS('https://example.com')).toBe(false);
    });

    it('should detect event handlers in HTML', () => {
      const validator = new SecurityValidator();
      expect(validator.detectXSS('<img src=x onerror=alert(1)>')).toBe(true);
      expect(validator.detectXSS('<div>content</div>')).toBe(false);
    });
  });

  describe('SQL injection patterns', () => {
    it('should detect basic SQL injection attempts', () => {
      const validator = new SecurityValidator();
      expect(validator.detectSQLInjection("' OR 1=1--")).toBe(true);
      expect(validator.detectSQLInjection("normal input")).toBe(false);
    });

    it('should detect union-based attacks', () => {
      const validator = new SecurityValidator();
      expect(validator.detectSQLInjection("' UNION SELECT password FROM users--")).toBe(true);
    });

    it('should detect comment-based attacks', () => {
      const validator = new SecurityValidator();
      expect(validator.detectSQLInjection("admin'--")).toBe(true);
      expect(validator.detectSQLInjection("test'/*")).toBe(true);
    });
  });

  describe('file path validation', () => {
    it('should prevent directory traversal', () => {
      const validator = new SecurityValidator();
      expect(validator.validateFilePath('../../etc/passwd')).toBe(false);
      expect(validator.validateFilePath('./config.json')).toBe(true);
    });

    it('should validate file extensions', () => {
      const validator = new SecurityValidator();
      expect(validator.validateFileExtension('image.png')).toBe(true);
      expect(validator.validateFileExtension('script.php')).toBe(false);
      expect(validator.validateFileExtension('file.exe')).toBe(false);
    });
  });
});