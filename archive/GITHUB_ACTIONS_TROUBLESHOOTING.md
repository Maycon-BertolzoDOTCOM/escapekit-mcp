# GitHub Actions Troubleshooting Guide

## Current Status

### ✅ Working Components
- Node.js 20 configured
- Dependencies installed successfully
- Tests executed and generated `vitest-results.json`
- Test artifact uploaded successfully
- All adapters (Vitest, Mocha, Custom) available
- Kiwi XML-RPC client available (`.cjs` version)

### ❌ Known Issues
- Workflow fails during "Upload results to Kiwi TCMS" step
- Most likely cause: **GitHub Secrets not configured**

---

## Required GitHub Secrets

### 🔑 Mandatory Secrets

Configure these in: **Settings → Secrets and variables → Actions → New repository secret**

#### 1. KIWI_URL
- **Description**: URL of your Kiwi TCMS instance
- **Examples**:
  - Local: `https://localhost:8443`
  - Production: `https://kiwi-tcms.yourcompany.com`
  - Cloud: `https://public.tenant.kiwitcms.org`
- **Validation**: Should be a valid HTTPS URL

#### 2. KIWI_USERNAME
- **Description**: Username for Kiwi TCMS authentication
- **Example**: `admin` or your actual username
- **Validation**: Must be a valid user in your Kiwi TCMS instance

#### 3. KIWI_PASSWORD
- **Description**: Password for Kiwi TCMS authentication
- **Important**: Use a strong, automation-specific password
- **Note**: This password is stored securely in GitHub Secrets

### 🔧 Optional Secrets

#### 4. KIWI_PRODUCT_ID
- **Description**: Product ID in Kiwi TCMS
- **Default**: `1` if not specified
- **How to find**: Login to Kiwi TCMS → Products → Click on your product → Check URL for ID

#### 5. KIWI_TEST_PLAN_ID
- **Description**: Test Plan ID in Kiwi TCMS
- **Default**: `1` if not specified
- **How to find**: Login to Kiwi TCMS → Test Plans → Click on your plan → Check URL for ID

---

## Configuration Steps

### Step 1: Access Repository Settings

1. Go to: https://github.com/safevisionb-dotcom/escapekit-mcp/settings
2. In left sidebar, click **"Secrets and variables"**
3. Click **"Actions"**

### Step 2: Add Secrets

For each secret:

1. Click **"New repository secret"**
2. Enter the **Name** (e.g., `KIWI_URL`)
3. Enter the **Value** (e.g., `https://your-kiwi-tcms-instance.com`)
4. Click **"Add secret"**

### Step 3: Verify Secrets

After adding all secrets, you should see:
- ✅ KIWI_URL
- ✅ KIWI_USERNAME
- ✅ KIWI_PASSWORD
- ✅ KIWI_PRODUCT_ID (optional)
- ✅ KIWI_TEST_PLAN_ID (optional)

---

## Re-running the Workflow

### Option 1: Re-run Failed Jobs (Fastest)

1. Go to: https://github.com/safevisionb-dotcom/escapekit-mcp/actions
2. Click on the failed workflow run
3. In the top right, click **"Re-run jobs"**
4. Select **"Re-run failed jobs"**

### Option 2: Re-run All Jobs

1. Same as above, but select **"Re-run all jobs"**

### Option 3: Trigger New Run

1. Make a small commit or push to `phase3-ci-cd-test` branch
2. Workflow will trigger automatically

---

## Troubleshooting Errors

### Error: "KIWI_URL is not set"

**Cause**: Secret not configured or named incorrectly

**Solution**:
1. Check Settings → Secrets and variables → Actions
2. Verify secret name is exactly `KIWI_URL` (case-sensitive)
3. Re-run workflow

### Error: "Authentication failed"

**Cause**: Invalid username or password

**Solution**:
1. Verify username/password are correct
2. Test locally with same credentials:
   ```bash
   curl -X POST https://your-kiwi-tcms-instance.com/xml-rpc/ \
     -d '{"method":"Auth.login","params":["username","password"],"id":1}'
   ```
3. Update secrets if needed
4. Re-run workflow

### Error: "Failed to load custom Reporter from text"

**Status**: ✅ **FIXED** - This was resolved by creating `vitest.config.ts` in root

### Error: "Cannot find module '../src/adapters/vitest-adapter'"

**Status**: ✅ **FIXED** - Adapter exists and is properly imported

### Error: "vitest-results.json not found"

**Status**: ✅ **FIXED** - File is now generated correctly

---

## Verification Steps

After workflow runs successfully, verify:

### 1. In GitHub Actions
- ✅ All steps show green checkmark
- ✅ "Upload test artifacts" step completed
- ✅ Summary section shows test statistics

### 2. In Kiwi TCMS
- ✅ New TestRun created with build metadata
- ✅ All 1145 test results uploaded
- ✅ Test cases created (if new)
- ✅ Build information displayed (commit, branch, author)

### 3. In GitHub Actions Summary
Click on workflow run → Look for summary section:
```
## 📊 Test Results Upload Summary

- **Run ID**: 1234567890
- **Run Number**: 42
- **Commit**: abc1234
- **Branch**: phase3-ci-cd-test
- **Event**: push
- **Triggered by**: username

### 📦 Artifacts
Test results and coverage have been uploaded as artifacts.

### 🔗 Kiwi TCMS
Results have been uploaded to Kiwi TCMS for tracking.
```

---

## Local Testing

Before pushing to GitHub, test locally:

```bash
# Set environment variables
export KIWI_URL="https://your-kiwi-tcms-instance.com"
export KIWI_USERNAME="your-username"
export KIWI_PASSWORD="your-password"
export KIWI_PRODUCT_ID="1"
export KIWI_TEST_PLAN_ID="1"

# Run tests
npm test

# Upload results
npx tsx scripts/kiwi-upload-enhanced.mts \
  --file vitest-results.json \
  --framework vitest \
  --product-id 1 \
  --test-plan-id 1 \
  --verbose
```

---

## Workflow File Location

**File**: `.github/workflows/kiwi-tcms.yml`

**Current Configuration**:
- Node.js 20
- Triggers on: `main`, `develop`, `phase3-ci-cd-test`
- Runs on: `ubuntu-latest`
- Generates: `vitest-results.json`
- Uploads to: Kiwi TCMS
- Artifacts: `vitest-results.json`, `coverage/`

---

## Contact & Support

If issues persist:

1. Check GitHub Actions logs for detailed error messages
2. Expand the failed step and read the full error output
3. Verify all secrets are configured correctly
4. Test locally with same credentials
5. Review Kiwi TCMS logs (if accessible)

---

## Next Steps

After successful workflow execution:

1. ✅ Verify Kiwi TCMS shows new TestRun with metadata
2. ✅ Check all 1145 test results are uploaded
3. ✅ Validate build information (commit, branch, author)
4. ✅ Update `tasks.md` to mark Task 13 as complete
5. ✅ Consider proceeding to Task 14: "Configurar atualização de dashboards em tempo real"

---

**Last Updated**: 2026-03-19
**Branch**: phase3-ci-cd-test
**Commit**: 44bd7d8