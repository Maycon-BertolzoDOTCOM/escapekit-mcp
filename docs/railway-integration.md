# Railway Integration with Kiwi TCMS CI/CD

## Overview

This guide explains how to integrate your Railway deployments with Kiwi TCMS CI/CD for automated test result tracking and quality monitoring.

## Why Integrate Railway with Kiwi TCMS?

- **Automated Quality Gates**: Test results automatically uploaded on every Railway deploy
- **Continuous Monitoring**: Track test trends over time across Railway environments
- **Professional Image**: Demonstrate commitment to quality to potential users
- **Competitive Advantage**: Stand out in Railway marketplace with built-in testing infrastructure

## Prerequisites

- Railway account (Free or Pro)
- Kiwi TCMS instance (Self-hosted or cloud)
- Project configured with CI/CD integration (see [docs/ci-cd-quickstart.md](./ci-cd-quickstart.md))

## Railway Configuration

### 1. Environment Variables

Add these variables in your Railway project settings:

```bash
# Railway Environment Variables
KIWI_URL=https://your-kiwi-tcms.com
KIWI_USERNAME=your-api-user
KIWI_PASSWORD=your-api-password
KIWI_PRODUCT_ID=123
KIWI_TEST_PLAN_ID=456
```

### 2. Railway YAML Configuration

Create or update `railway.yml`:

```yaml
version: "1.0"

services:
  # Your application service
  app:
    buildCommand: npm install && npm run build
    startCommand: npm start
    env:
      - NODE_ENV=production
    
  # Test service (optional)
  test:
    buildCommand: npm install
    startCommand: npm test
    env:
      - NODE_ENV=test

# CI/CD integration
deployments:
  test:
    # Run tests before deploying
    command: npm test
    # Upload results to Kiwi TCMS
    command: npx ts-node scripts/kiwi-upload.ts --file vitest-results.json --framework vitest
    on:
      branch: [main, develop, feature/*]
```

### 3. GitHub Actions + Railway

Update `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Railway

on:
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run tests
        run: |
          npm ci
          npm test -- --reporter=json --outputFile=vitest-results.json
      
      - name: Upload to Kiwi TCMS
        env:
          KIWI_URL: ${{ secrets.KIWI_URL }}
          KIWI_USERNAME: ${{ secrets.KIWI_USERNAME }}
          KIWI_PASSWORD: ${{ secrets.KIWI_PASSWORD }}
        run: |
          npx ts-node scripts/kiwi-upload.ts \
            --file vitest-results.json \
            --framework vitest \
            --verbose

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Railway
        uses: railwayapp/cli-action@v3.0.0
        with:
          railway-token: ${{ secrets.RAILWAY_TOKEN }}
          service: your-service-id
```

## Railway CLI Integration

### Automated Deploy with Test Upload

Create `scripts/deploy-to-railway.sh`:

```bash
#!/bin/bash

# Set Railway project
export RAILWAY_PROJECT_ID="${RAILWAY_PROJECT_ID:-your-project-id}"

# Run tests
echo "Running tests..."
npm test -- --reporter=json --outputFile=vitest-results.json

# Upload to Kiwi TCMS
echo "Uploading results to Kiwi TCMS..."
npx ts-node scripts/kiwi-upload.ts \
  --file vitest-results.json \
  --framework vitest \
  --verbose

# Deploy to Railway if tests pass
if [ $? -eq 0 ]; then
  echo "Tests passed. Deploying to Railway..."
  railway up --service=app
else
  echo "Tests failed. Aborting deploy."
  exit 1
fi
```

Make it executable:
```bash
chmod +x scripts/deploy-to-railway.sh
```

## Railway Template Integration

### Create a Railway-Ready Template

1. **Include CI/CD Files**:
   - `.github/workflows/kiwi-tcms.yml`
   - `.gitlab-ci.yml`
   - `scripts/kiwi-upload.ts`
   - `.env.example`

2. **Update README.md**:

```markdown
# [Your Project Name]

[![Railway](https://img.shields.io/badge/Railway-deploy-blue)](https://railway.app/new/template?template=YOUR_TEMPLATE_ID)
[![Kiwi TCMS](https://img.shields.io/badge/Kiwi%20TCMS-Integrated-green)](https://kiwitcms.org/)

## Quick Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=YOUR_TEMPLATE_ID)

## Features

- ✅ One-click Railway deployment
- ✅ Automated test execution
- ✅ Kiwi TCMS integration for test tracking
- ✅ Multi-environment support (dev, staging, prod)
- ✅ Zero-configuration setup

## Test Result Tracking

After deployment, your test results are automatically uploaded to Kiwi TCMS for quality tracking.

## Configuration

1. Click "Deploy on Railway"
2. Configure environment variables (see `.env.example`)
3. Deploy!

For detailed setup, see [docs/railway-integration.md](docs/railway-integration.md)
```

3. **Add Railway Button**:

Create `docs/railway-button.md` with the button code:

```html
<a href="https://railway.app/new/template?template=YOUR_TEMPLATE_ID">
  <img src="https://railway.app/button.svg" alt="Deploy on Railway">
</a>
```

## Multi-Environment Setup

### Development, Staging, Production

Configure separate Kiwi TCMS Test Plans for each environment:

```bash
# Development
KIWI_TEST_PLAN_ID=100

# Staging
KIWI_TEST_PLAN_ID=200

# Production
KIWI_TEST_PLAN_ID=300
```

### Environment-Specific Deployments

```yaml
# railway.yml
services:
  app-dev:
    env:
      - ENVIRONMENT=development
      - KIWI_TEST_PLAN_ID=100
  
  app-staging:
    env:
      - ENVIRONMENT=staging
      - KIWI_TEST_PLAN_ID=200
  
  app-prod:
    env:
      - ENVIRONMENT=production
      - KIWI_TEST_PLAN_ID=300
```

## Monitoring and Dashboards

### Kiwi TCMS Dashboard Setup

1. **Create Product** in Kiwi TCMS
2. **Create Test Plans** for each Railway environment
3. **Configure Dashboards** to show:
   - Test pass rate over time
   - Failed tests by environment
   - Deployment frequency vs. test failures
   - Test execution time trends

### Railway Integration Dashboard

Example Kiwi TCMS dashboard query:

```sql
SELECT 
  environment,
  COUNT(*) as total_tests,
  SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
  ROUND(SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as pass_rate
FROM test_runs
WHERE execution_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY environment
ORDER BY execution_date DESC
```

## Troubleshooting

### Railway Deploy Fails

**Issue**: Tests fail before Railway deploy

**Solution**:
```bash
# Run tests locally first
npm test

# Dry-run Kiwi TCMS upload
npx ts-node scripts/kiwi-upload.ts --file vitest-results.json --framework vitest --dry-run
```

### Kiwi TCMS Upload Fails on Railway

**Issue**: Network timeout or authentication error

**Solution**:
1. Verify Railway environment variables are set
2. Check Kiwi TCMS URL is accessible from Railway
3. Verify credentials are correct
4. Check Railway logs for detailed error messages

### Test Results Not Appearing

**Issue**: Deploy succeeds but no results in Kiwi TCMS

**Solution**:
```bash
# Check Railway logs
railway logs

# Verify upload script executed
# Look for "Kiwi TCMS upload completed" in logs
```

## Best Practices

### 1. Separate Test Plans per Environment

- Development: Fast feedback, optional tests
- Staging: Full test suite, pre-production validation
- Production: Smoke tests, critical path validation

### 2. Quality Gates

```yaml
# Only deploy if test pass rate > 95%
deploy:
  command: |
    PASS_RATE=$(npm test -- --passRate)
    if [ "$PASS_RATE" -lt 95 ]; then
      echo "Pass rate $PASS_RATE% < 95%. Aborting."
      exit 1
    fi
    railway up
```

### 3. Notification Integration

Configure Railway and Kiwi TCMS to send notifications:

```yaml
# Railway notifications
notifications:
  slack:
    webhook: ${{ secrets.SLACK_WEBHOOK }}
    on:
      - deploy_success
      - deploy_failure
      - test_failure
```

## Monetization Considerations

### Value Proposition for Users

With Kiwi TCMS integration, your Railway template offers:

1. **Built-in Quality Monitoring**: Users don't need to set up test tracking
2. **Professional Infrastructure**: Demonstrates commitment to quality
3. **Competitive Advantage**: Stand out from other templates
4. **Time Savings**: Automated test result management

### Pricing Strategy

- **Free Tier**: Basic test result upload
- **Pro Tier ($10/mo)**: Advanced dashboards, custom reports
- **Enterprise ($50/mo)**: SLA support, dedicated Kiwi TCMS instance

### Marketing Copy

```
🚀 Deploy in minutes, monitor for life

The only Railway template with built-in Kiwi TCMS integration.
Track test quality across environments automatically.
```

## Resources

- [Railway Documentation](https://docs.railway.app/)
- [Railway Templates](https://railway.app/templates)
- [Kiwi TCMS Integration](./ci-cd-quickstart.md)
- [Security Best Practices](./security-best-practices.md)

## Support

For issues with Railway integration:
1. Check [Railway Docs](https://docs.railway.app/)
2. Review [CI/CD Guide](./ci-cd.md)
3. Open an issue in this repository
4. Contact support at support@yourproject.com
