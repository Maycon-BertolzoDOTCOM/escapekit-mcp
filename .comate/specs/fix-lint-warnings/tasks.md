# Fix Lint Warnings

## Tasks

### Task 1: Fix no-useless-escape warnings in adapters
- [ ] 1.1 Remove unnecessary escape characters in `custom-parser.ts` (lines 186, 193)
- [ ] 1.2 Remove unnecessary escape characters in `jest-adapter.ts` (lines 155, 162)
- [ ] 1.3 Remove unnecessary escape characters in `mocha-adapter.ts` (lines 195, 202)
- [ ] 1.4 Remove unnecessary escape characters in `playwright-adapter.ts` (lines 165, 172)

### Task 2: Fix unused variables
- [ ] 2.1 Remove unused `SlackElement` in `notifications.ts` (line 58)

### Task 3: Fix function declaration
- [ ] 3.1 Move function declaration in `server.ts` to root level (line 55)

### Task 4: Final verification
- [ ] 4.1 Run `npm run lint` and verify no warnings remain
- [ ] 4.2 Add `--max-warnings 0` to lint script in `package.json`
- [ ] 4.3 Update CI workflow to fail on warnings