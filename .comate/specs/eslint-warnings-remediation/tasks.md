# ESLint Warnings Remediation — Tasks (111 warnings)

## Task List

- [x] Task 1: Exploratory - Confirm initial state
  - 1.1: Run `npm run lint 2>&1 | tee /tmp/lint-before.txt` and confirm 111 warnings
  - 1.2: Run `npm run lint -- --max-warnings 0` and confirm non-zero exit code

- [x] Task 2: Fix `src/adapters/custom-parser.ts` (2 warnings)
  - 2.1: Remove unnecessary `\` in regex at line 186 (`\[` → `[`)
  - 2.2: Remove unnecessary `\` in regex at line 193 (`\[` → `[`)
  - 2.3: Verify with `eslint src/adapters/custom-parser.ts`

- [x] Task 3: Fix `src/adapters/cypress-adapter.ts` (4 warnings)
  - 3.1: Clean regex at line 169 (`\(`, `\)`, `\[` → `(`, `)`, `[`)
  - 3.2: Clean regex at line 176 (`\[` → `[`)
  - 3.3: Verify with `eslint src/adapters/cypress-adapter.ts`

- [x] Task 4: Fix `src/adapters/jest-adapter.ts` (4 warnings)
  - 4.1: Clean regex at line 155 (`\(`, `\)`, `\[` → `(`, `)`, `[`)
  - 4.2: Clean regex at line 162 (`\[` → `[`)
  - 4.3: Verify with `eslint src/adapters/jest-adapter.ts`

- [x] Task 5: Fix `src/adapters/mocha-adapter.ts` (7 warnings)
  - 5.1: Clean regex at line 195
  - 5.2: Clean regex at line 202
  - 5.3: Handle ANSI control char at line 211 (add `// eslint-disable-next-line no-control-regex`)
  - 5.4: Verify with `eslint src/adapters/mocha-adapter.ts`

- [x] Task 6: Fix `src/adapters/playwright-adapter.ts` (9 warnings)
  - 6.1: Replace `any` in `PlaywrightTestResult` with `PlaywrightError[]` interface
  - 6.2: Replace `any` in `PlaywrightOutput.config` with `Record<string, unknown>`
  - 6.3: Clean regexes at lines 160, 167
  - 6.4: Handle ANSI control char at line 176
  - 6.5: Verify with `eslint src/adapters/playwright-adapter.ts`

- [x] Task 7: Fix `src/adapters/vitest-adapter.ts` (12 warnings)
  - 7.1: Replace `meta?: any` with `Record<string, unknown>`
  - 7.2: Replace error typing in `load()` catch block
  - 7.3-7.7: Replace all non-null assertions (`!`) with optional chaining
  - 7.8: Clean regex at line 258
  - 7.9: Handle ANSI control char at line 279
  - 7.10: Verify with `eslint src/adapters/vitest-adapter.ts`

- [ ] Task 8: Fix `src/generators/TemplateEngine.ts` (2 warnings)
  - 8.1: Replace non-null assertion at line 153
  - 8.2: Replace non-null assertion at line 299
  - 8.3: Verify with `eslint src/generators/TemplateEngine.ts`

- [ ] Task 9: Fix `src/lib/kiwi-client.ts` (20 warnings)
  - 9.1: Replace `any` in RPC methods with `KiwiRawResult` interface
  - 9.2: Replace all non-null assertions with proper guards
  - 9.3: Verify with `eslint src/lib/kiwi-client.ts`

- [ ] Task 10: Fix `src/lib/logger.ts` (4 warnings)
  - 10.1: Replace `...args: any[]` with `unknown[]` in all methods
  - 10.2: Verify with `eslint src/lib/logger.ts`

- [ ] Task 11: Fix `src/lib/notifications.ts` (10 warnings)
  - 11.1: Define `SlackBlock` interface
  - 11.2: Replace all `any` types with specific types
  - 11.3: Verify with `eslint src/lib/notifications.ts`

- [ ] Task 12: Fix `src/lib/retry.ts` (5 warnings)
  - 12.1: Replace `any` with `unknown` and add type guards
  - 12.2: Verify with `eslint src/lib/retry.ts`

- [ ] Task 13: Fix `src/lib/test-parser.ts` (1 warning)
  - 13.1: Replace `any[]` with proper typing
  - 13.2: Verify with `eslint src/lib/test-parser.ts`

- [ ] Task 14: Fix `src/security/DeepDependencyScanner.ts` (1 warning)
  - 14.1: Replace non-null assertion with guard
  - 14.2: Verify with `eslint src/security/DeepDependencyScanner.ts`

- [ ] Task 15: Fix `src/security/IssueGenerator.ts` (1 warning)
  - 15.1: Replace non-null assertion with guard
  - 15.2: Verify with `eslint src/security/IssueGenerator.ts`

- [ ] Task 16: Fix `src/security/LockFileParser.ts` (1 warning)
  - 16.1: Replace non-null assertion with guard
  - 16.2: Verify with `eslint src/security/LockFileParser.ts`

- [ ] Task 17: Fix `src/server.ts` (3 warnings)
  - 17.1: Define `MCPParams` interface
  - 17.2: Replace `any` with proper typing
  - 17.3: Verify with `eslint src/server.ts`

- [ ] Task 18: Fix `src/tools/validate.ts` (1 warning)
  - 18.1: Replace type assertion with proper type
  - 18.2: Verify with `eslint src/tools/validate.ts`

- [ ] Task 19: Fix `src/validate/environments/BrowserEnvironment.ts` (3 warnings)
  - 19.1-19.3: Replace `any` with proper Playwright types
  - 19.4: Verify with `eslint src/validate/environments/BrowserEnvironment.ts`

- [ ] Task 20: Fix `src/validate/validators/BuildValidator.ts` (2 warnings)
  - 20.1-20.2: Replace `any` with proper types
  - 20.3: Verify with `eslint src/validate/validators/BuildValidator.ts`

- [ ] Task 21: Fix `src/validate/validators/DependencyValidator.ts` (4 warnings)
  - 21.1-21.4: Replace `any` with proper interfaces
  - 21.5: Verify with `eslint src/validate/validators/DependencyValidator.ts`

- [ ] Task 22: Fix `src/validate/validators/WebGLValidator.ts` (8 warnings)
  - 22.1-22.3: Replace `any` with proper Playwright types
  - 22.4: Verify with `eslint src/validate/validators/WebGLValidator.ts`

- [ ] Task 23: Fix `src/validators/E2EValidator.ts` (3 warnings)
  - 23.1-23.2: Replace `any` with `unknown`
  - 23.3: Verify with `eslint src/validators/E2EValidator.ts`

- [ ] Task 24: Fix `src/validators/RuntimeValidator.ts` (2 warnings)
  - 24.1-24.2: Replace non-null assertions
  - 24.3: Verify with `eslint src/validators/RuntimeValidator.ts`

- [ ] Task 25: Global Verification and CI Enforcement
  - 25.1: Run final lint check (`npm run lint`)
  - 25.2: Verify TypeScript compilation (`tsc --noEmit`)
  - 25.3: Run all tests (`npm test`)
  - 25.4: Update `package.json` lint command
  - 25.5: Update CI workflow file
