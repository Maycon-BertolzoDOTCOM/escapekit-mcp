# ⚡ Skill Improvement Triggers — EscapeKit MCP

> Gatilhos automáticos que disparam revisões, treinamentos e melhorias no sistema.

---

## 🚨 Trigger 1: New Security Vulnerability Discovered

**Condition:** A new attack vector (e.g., GlassWorm-style supply-chain attack, homoglyph typosquatting) is publicly disclosed.

**Action:**
1. Create a **P0 task** in the backlog
2. Use `.ai-templates/new-detector.md` to scaffold the detector
3. Add the vulnerability pattern to `knowledge-base.json`
4. Write regression tests with real-world samples
5. Update `PROJECT_HEALTH.md` security coverage table

**SLA:** Detector prototype within 48 hours of disclosure.

---

## 🎯 Trigger 2: False Positive Reported

**Condition:** A legitimate package or API is incorrectly flagged (e.g., a real npm package marked as ghost import).

**Action:**
1. Add a **regression test** with the false-positive case
2. Adjust the detection algorithm (e.g., extend NPM cache TTL, add to whitelist)
3. If recurring pattern: add the package to `knowledge-base.json` with `confidence: 1.0`
4. Tag the fix with `fix(analyzer): false positive for [package]`

**SLA:** Fix within 24 hours for P0 packages, 1 week for others.

---

## 📉 Trigger 3: Performance Degradation

**Condition:** Analysis time for 50 dependencies exceeds 5 seconds, or analysis of 1000 LOC exceeds 30 seconds.

**Action:**
1. Profile with Node.js `--inspect` or `clinic.js`
2. Check NPM registry cache hit rate
3. Consider batch/parallel NPM queries
4. Add performance benchmarks to CI

**SLA:** Investigate within 1 week, fix within 2 weeks.

---

## 🧪 Trigger 4: Test Coverage Drops Below 70%

**Condition:** `npm run test:coverage` reports overall coverage below 70%.

**Action:**
1. Identify uncovered modules
2. Use `.ai-templates/integration-test.md` for pipeline tests
3. Prioritize `src/security/` and `src/transformers/` coverage
4. Block merging PRs that decrease coverage

---

## 😓 Trigger 5: Developer Sentiment ≤ 2

**Condition:** `PROJECT_HEALTH.md` sentiment score drops to 2 or below.

**Action:**
1. **Stop and review:** Is the scope too large? Are deadlines realistic?
2. Reduce scope to absolute essentials for current milestone
3. Take a 24-hour break from the project
4. Consider pairing/delegating complex tasks to AI swarm
5. Re-evaluate timeline and communicate adjusted expectations

---

## 🔄 Trigger 6: User Feedback Loop

**Condition:** An early adopter or beta user reports an issue via `escapekit feedback` or GitHub Issues.

**Action:**
1. Categorize: bug, feature request, false positive, performance
2. If bug → Create task with reproducer
3. If false positive → Trigger 2
4. If feature request → Evaluate against backlog and Phase roadmap
5. Respond within 48 hours (even if just acknowledging)

---

## 📅 Action Plan: The Final 20% (Until 31/03/2026)

### Semana 1 (16–22 Mar): Desbloquear Phase 4 (Validação)

| Task | Description | Status |
|------|-------------|--------|
| RuntimeValidator (Task 4.1) | Build/dev server verification with timeout | ⏳ |
| Playwright E2E base (Task 4.2) | Page load + JS error detection | ⏳ |
| Validation scoring (Task 4.4) | Overall score algorithm (0-1) | ⏳ |

**AI Swarm Strategy:** Use `.ai-templates/integration-test.md` to scaffold E2E tests. Use Cursor/Claude for complex Playwright integration.

### Semana 2 (23–30 Mar): Tests + Optimization + Docs

| Task | Description | Status |
|------|-------------|--------|
| Integration tests | Full analyze→generate→validate flow with real projects | ⏳ |
| NPM cache optimization | Persistent cache + parallel queries | ⏳ |
| Unit test gaps | Phase 0 tasks 0.7–0.9 | ⏳ |
| Documentation polish | Refine ONBOARDING.md, update README.md | ⏳ |

**AI Swarm Strategy:** Use AI to auto-generate test cases from fixtures. Use Claude Code for cache performance analysis.

### 31/03 (Meta Final): Beta Launch

| Task | Description | Status |
|------|-------------|--------|
| Health check | Run `scripts/health-check.sh`, all green | ⏳ |
| Invite early adopters | 5 test users with structured feedback | ⏳ |
| Feedback pipeline | `escapekit feedback` command functional | ⏳ |
| Knowledge base expansion | 20+ ghost→real mappings | ⏳ |

---

## 🔁 Continuous Improvement Cycle

```
┌─────────────────────┐
│   Detect Signal      │  (vulnerability, false positive, feedback, perf drop)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Classify & Triage  │  (P0 → immediate, P1 → this sprint, P2 → backlog)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Execute Fix        │  (use AI templates, write tests, update KB)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Verify & Measure   │  (health check, coverage, performance benchmark)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Update Health      │  (PROJECT_HEALTH.md, sentiment, metrics)
└──────────┘──────────┘
           │
           └──→ repeat
```
