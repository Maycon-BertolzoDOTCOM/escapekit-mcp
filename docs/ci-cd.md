# Kiwi TCMS CI/CD Integration

## Environment Variables

Required: KIWI_URL, KIWI_USERNAME, KIWI_PASSWORD

Optional: KIWI_PRODUCT_ID, KIWI_TEST_PLAN_ID

## GitHub Actions

Add secrets in repo settings

Workflow: .github/workflows/kiwi-tcms.yml

## GitLab CI

Add variables in project settings

Pipeline: .gitlab-ci.yml

## Local

npx ts-node scripts/kiwi-upload.ts --file results.json --framework vitest
