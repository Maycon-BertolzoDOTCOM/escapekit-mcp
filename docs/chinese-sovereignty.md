# Chinese Technological Sovereignty (自主创新)

Six components for Chinese enterprise environments: domestic mirrors, air-gapped deployments,
security validation, audit trails, reproducible builds, and request throttling.

---

## 1. Overview

| Component | Class | Purpose |
|---|---|---|
| Mirror Registry | `MirrorRegistry` | Domestic npm mirrors with sequential fallback |
| Offline Cache | `OfflinePackageCache` | Pre-populated metadata for air-gapped environments |
| Security Validator | `SecurityValidator` | CVE, license, deprecation, and staleness checks |
| Audit Logger | `AuditLogger` | Immutable trail of every external operation |
| Lock File Generator | `LockFileGenerator` | Deterministic builds via integrity-pinned lock files |
| Rate Limiter | `RateLimiter` | Token-bucket throttling for registry requests |

---

## 2. Mirror Configuration

Mirrors are tried in priority order. Chinese mirrors use a 5 s timeout; the global fallback uses 10 s.

```ts
import { MirrorRegistry } from './src/mirrors/MirrorRegistry.js';

// priority 1 — npmmirror  https://registry.npmmirror.com   5 s
// priority 2 — taobao     https://registry.npm.taobao.org  5 s
// priority 3 — npmjs      https://registry.npmjs.org       10 s

const registry = new MirrorRegistry();
const { mirror } = await registry.fetch('axios');
console.log(mirror.name); // "npmmirror" when reachable

// Disable Chinese mirrors or inject a private registry
const corp = new MirrorRegistry({
  enableChineseMirrors: false,
  customMirrors: [{ name: 'internal', url: 'https://npm.corp.example.com', priority: 0, timeout: 3000 }],
});
```

---

## 3. Offline / Air-Gapped Deployment

Pre-populate on a connected machine, export, then load in the isolated environment.

```ts
import { OfflinePackageCache } from './src/cache/OfflinePackageCache.js';

const cache = new OfflinePackageCache({ cacheDir: './package-cache' });

// Connected machine: populate and export
await cache.populate([
  { name: 'lodash', version: '4.17.21', exists: true, cachedAt: new Date().toISOString() },
]);
await cache.exportCache('./dist/packages.json');

// Air-gapped machine: load from disk, no fetch needed
await cache.loadFromDisk();
const info = cache.getCached('lodash'); // { name, version, ... }

// Hard-block accidental network access
const registry = new MirrorRegistry({ offlineMode: true });
// registry.fetch(...) → throws "Offline mode: network requests disabled"
```

---

## 4. Security Validation

Checks CVEs, license compatibility, deprecation, and maintenance staleness.

```ts
import { SecurityValidator } from './src/security/SecurityValidator.js';

const validator = new SecurityValidator({ maxStalenessMonths: 12 });

const result = await validator.validate('event-stream', { deprecated: false });
console.log(result.safe);            // false — CVE-2018-16462 detected
console.log(result.vulnerabilities); // ['CVE-2018-16462: malicious code injection']

// Custom license allowlist
const strict = new SecurityValidator({ allowedLicenses: ['MIT', 'Apache-2.0'] });
const r = await strict.validate('pkg', { license: 'GPL-3.0' });
console.log(r.licenseCompatible);    // false
```

---

## 5. Audit Logging

Every operation is recorded with timestamp, mirror, duration, and outcome.

```ts
import { AuditLogger } from './src/audit/AuditLogger.js';

const audit = new AuditLogger();
audit.logRequest({ operation: 'registry-fetch', packageName: 'axios',
                   mirror: 'npmmirror', success: true, duration: 42 });

const stats = audit.getStatistics();
// { totalRequests, successfulRequests, failedRequests, successRate,
//   averageDuration, mirrorUsage: { npmmirror: 1 } }

await audit.exportLogs('./audit.json');
```

---

## 6. Reproducible Builds

Pins every dependency to an exact version with a `sha256` integrity hash.

```ts
import { LockFileGenerator } from './src/lockfile/LockFileGenerator.js';

const gen = new LockFileGenerator();
const deps = new Map([['lodash', '^4.17.21'], ['express', '^4.18.2']]);

const lockFile = gen.generate('my-app', '1.0.0', deps);
await gen.writeToFile(lockFile, 'package-lock.json');

const { valid, errors } = await gen.validate('package-lock.json');
// valid: true, errors: []
```

---

## 7. Rate Limiting

Sliding-window token bucket to prevent hammering registries.

```ts
import { RateLimiter } from './src/ratelimit/RateLimiter.js';

const limiter = new RateLimiter({ maxRequests: 10, windowMs: 1000, minDelayMs: 50 });

for (const pkg of packages) {
  await limiter.throttle(); // blocks until a slot is available
  await registry.fetch(pkg);
}

limiter.reset(); // clear window state
```
