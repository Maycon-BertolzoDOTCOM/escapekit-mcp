# CI/CD Quick Start Guide

## Configure in 5 Minutes

### Step 1: Environment Variables (2 min)

Copy the template:
```bash
cp .env.example .env
```

Edit `.env` with your Kiwi TCMS credentials:
```bash
KIWI_URL=https://your-kiwi-tcms.com
KIWI_USERNAME=your-api-user
KIWI_PASSWORD=your-api-password
KIWI_PRODUCT_ID=123
KIWI_TEST_PLAN_ID=456
```

### Step 2: GitHub Actions (2 min)

1. Go to repository Settings → Secrets and variables → Actions
2. Add secrets:
   - `KIWI_URL`
   - `KIWI_USERNAME`
   - `KIWI_PASSWORD`
   - `KIWI_PRODUCT_ID` (optional)
   - `KIWI_TEST_PLAN_ID` (optional)

3. Push code to trigger workflow

### Step 3: GitLab CI (1 min)

1. Go to Settings → CI/CD → Variables
2. Add variables:
   - `KIWI_URL`
   - `KIWI_USERNAME`
   - `KIWI_PASSWORD`
   - `KIWI_PRODUCT_ID` (optional)
   - `KIWI_TEST_PLAN_ID` (optional)

3. Commit and push code

## Test Locally

```bash
# Dry-run to validate
npx ts-node scripts/kiwi-upload.ts --file vitest-results.json --framework vitest --dry-run

# Upload for real
npx ts-node scripts/kiwi-upload.ts --file vitest-results.json --framework vitest
```

## Verify

1. Check CI/CD logs for "Kiwi TCMS upload completed"
2. Log into Kiwi TCMS
3. Navigate to your Product → Test Plan → Test Runs
4. See your test results!

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Authentication failed | Check KIWI_URL, USERNAME, PASSWORD |
| File not found | Ensure test results path is correct |
| Framework error | Verify --framework matches your test runner |

For more details, see [docs/ci-cd.md](./ci-cd.md)
