# Kiwi TCMS CI/CD Integration - Deployment Checklist

## Pre-Deployment Checklist

Before deploying to production, verify the following items:

### ✅ Configuration

- [ ] `.env.example` copied to `.env`
- [ ] Kiwi TCMS credentials configured in `.env`
- [ ] `KIWI_URL` points to correct instance
- [ ] `KIWI_USERNAME` and `KIWI_PASSWORD` are valid
- [ ] Optional: `KIWI_PRODUCT_ID` and `KIWI_TEST_PLAN_ID` configured

### ✅ Script Verification

- [ ] `scripts/kiwi-upload.ts` exists and is executable
- [ ] Dry-run mode tested locally:
  ```bash
  npx ts-node scripts/kiwi-upload.ts --file vitest-results.json --framework vitest --dry-run
  ```
- [ ] Test results file format matches framework type
- [ ] No authentication errors in dry-run output

### ✅ GitHub Actions Deployment

- [ ] `.github/workflows/kiwi-tcms.yml` exists
- [ ] GitHub Secrets configured:
  - [ ] `KIWI_URL`
  - [ ] `KIWI_USERNAME`
  - [ ] `KIWI_PASSWORD`
  - [ ] `KIWI_PRODUCT_ID` (optional)
  - [ ] `KIWI_TEST_PLAN_ID` (optional)
- [ ] Workflow file syntax validated
- [ ] Test command configured correctly
- [ ] Upload step configured with correct framework

### ✅ GitLab CI Deployment

- [ ] `.gitlab-ci.yml` exists
- [ ] GitLab CI/CD Variables configured:
  - [ ] `KIWI_URL`
  - [ ] `KIWI_USERNAME`
  - [ ] `KIWI_PASSWORD`
  - [ ] `KIWI_PRODUCT_ID` (optional)
  - [ ] `KIWI_TEST_PLAN_ID` (optional)
- [ ] Pipeline syntax validated
- [ ] Stages configured correctly (test, upload, report)
- [ ] Artifacts configured for test results

### ✅ Railway Deployment

- [ ] `railway.yml` exists (if using Railway)
- [ ] Railway environment variables configured
- [ ] Deploy-to-Railway script created (optional)
- [ ] "Deploy on Railway" button added to README.md
- [ ] Railway template created with all CI/CD files

### ✅ Security

- [ ] `.env` in `.gitignore`
- [ ] No credentials committed to repository
- [ ] HTTPS enforced (`KIWI_URL` uses https://)
- [ ] SSL certificate validation enabled
- [ ] Dedicated service account created in Kiwi TCMS
- [ ] Service account has minimal permissions

### ✅ Documentation

- [ ] `docs/ci-cd.md` updated with project-specific details
- [ ] `docs/ci-cd-quickstart.md` reviewed
- [ ] `docs/security-best-practices.md` reviewed
- [ ] `docs/railway-integration.md` reviewed (if using Railway)
- [ ] `README-KIWI-TCMS-INTEGRATION.md` updated

## Deployment Steps

### Step 1: Local Verification

1. Copy environment template:
   ```bash
   cp .env.example .env
   ```

2. Configure credentials in `.env`:
   ```bash
   KIWI_URL=https://your-kiwi-tcms.com
   KIWI_USERNAME=your-api-user
   KIWI_PASSWORD=your-api-password
   KIWI_USERNAME=your-api-password
   KIWI_PRODUCT_ID=123
   KIWI_TEST_PLAN_ID=456
   ```

3. Run tests with dry-run:
   ```bash
   npx ts-node scripts/kiwi-upload.ts --file vitest-results.json --framework vitest --dry-run
   ```

4. Verify dry-run output shows no errors

### Step 2: GitHub Actions Deployment

1. Go to repository Settings → Secrets and variables → Actions

2. Add secrets:
   - `KIWI_URL`
   - `KIWI_USERNAME`
   - `KIWI_PASSWORD`
   - `KIWI_PRODUCT_ID` (optional)
   - `KIWI_TEST_PLAN_ID` (optional)

3. Commit and push `.github/workflows/kiwi-tcms.yml`

4. Trigger workflow manually or push code

5. Monitor workflow logs for "Kiwi TCMS upload completed"

### Step 3: GitLab CI Deployment

1. Go to Settings → CI/CD → Variables

2. Add variables:
   - `KIWI_URL`
   - `KIWI_USERNAME`
   - `KIWI_PASSWORD`
   - `KIWI_PRODUCT_ID` (optional)
   - `KIWI_TEST_PLAN_ID` (optional)

3. Mark variables as "Protected" if applicable

4. Commit and push `.gitlab-ci.yml`

5. Monitor pipeline logs for successful upload

### Step 4: Railway Deployment (Optional)

1. Create Railway project or use existing

2. Configure environment variables in Railway project

3. Add "Deploy on Railway" button to README.md:
   ```html
   <a href="https://railway.app/new/template?template=YOUR_TEMPLATE_ID">
     <img src="https://railway.app/button.svg" alt="Deploy on Railway">
   </a>
   ```

4. Test full deployment cycle:
   ```bash
   ./scripts/deploy-to-railway.sh
   ```

## Post-Deployment Verification

### ✅ Functional Tests

- [ ] Test results successfully uploaded to Kiwi TCMS
- [ ] Results visible in Kiwi TCMS dashboard
- [ ] Test status correctly reported (passed/failed)
- [ ] Test execution time recorded
- [ ] Multiple test runs tracked separately

### ✅ Integration Tests

- [ ] GitHub Actions workflow completes successfully
- [ ] GitLab CI pipeline completes successfully
- [ ] Local upload works correctly
- [ ] Railway deployment (if applicable) works correctly

### ✅ Error Handling

- [ ] Network errors trigger retry mechanism
- [ ] Authentication failures show clear error messages
- [ ] Invalid test results rejected with helpful message
- [ ] Timeout errors handled gracefully

### ✅ Performance

- [ ] Upload completes within expected time (< 2 minutes for 1000 tests)
- [ ] Retry mechanism works without excessive delays
- [ ] Batch processing optimizes large test suites
- [ ] No memory leaks in upload script

### ✅ Security

- [ ] No credentials visible in logs
- [ ] All API calls use HTTPS
- [ ] Test results sanitized before upload
- [ ] Access logs show expected IP addresses

## Rollback Procedures

If issues occur during deployment:

### GitHub Actions Rollback

1. Disable workflow:
   ```bash
   git rm .github/workflows/kiwi-tcms.yml
   git commit -m "Disable Kiwi TCMS upload"
   git push
   ```

2. Or rename workflow file:
   ```bash
   mv .github/workflows/kiwi-tcms.yml .github/workflows/kiwi-tcms.yml.disabled
   ```

### GitLab CI Rollback

1. Disable pipeline job:
   ```yaml
   # In .gitlab-ci.yml
   upload-to-kiwi-tcms:
     when: manual  # Change from 'always' to 'manual'
   ```

2. Or comment out upload job

### Railway Rollback

1. Remove environment variables from Railway project
2. Redeploy without Kiwi TCMS integration

## Troubleshooting Quick Reference

| Issue | Quick Fix |
|-------|-----------|
| Upload fails | Verify credentials, check KIWI_URL |
| Timeout error | Increase timeout, check network |
| Wrong test count | Verify framework type matches test runner |
| Results not visible | Check Product ID and Test Plan ID |
| Retry loop broken | Check Kiwi TCMS API status |

## Support Contacts

For deployment issues:
1. Check [Troubleshooting Guide](ci-cd.md#troubleshooting)
2. Review [Security Best Practices](security-best-practices.md)
3. Check Kiwi TCMS logs
4. Review CI/CD logs (GitHub Actions / GitLab CI)
5. Open issue in project repository

## Deployment Complete Checklist

- [ ] All pre-deployment items verified
- [ ] All deployment steps completed
- [ ] All post-deployment tests passed
- [ ] Documentation updated with deployment details
- [ ] Team notified of deployment
- [ ] Monitoring configured
- [ ] Rollback procedures documented

---

**Deployment Status**: ⬜ Pending / ✅ Complete

**Deployment Date**: ___________

**Deployed By**: ___________

**Notes**: _______________________________________________

---

*This checklist ensures successful deployment of Kiwi TCMS CI/CD integration.*
