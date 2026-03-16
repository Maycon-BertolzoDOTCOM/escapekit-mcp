#!/bin/bash

set -e

echo "🧪 Testing CI/CD pipeline..."

# Create test branch
BRANCH_NAME="test-deploy-$(date +%s)"
git checkout -b $BRANCH_NAME

# Make a small change
echo "# Test deployment" >> TEST_DEPLOY.md

# Commit and push
git add TEST_DEPLOY.md
git commit -m "test: test CI/CD deployment"
git push origin $BRANCH_NAME

echo "✅ Test commit pushed to branch: $BRANCH_NAME"
echo "🔍 Check GitHub Actions at: https://github.com/$(git remote get-url origin | sed 's/.*://; s/.git$//')/actions"

# Wait for CI to complete
echo "⏳ Waiting for CI to complete (approx 5 minutes)..."
sleep 300

# Check CI status
GH_TOKEN="${GH_TOKEN:-}"
if [ -z "$GH_TOKEN" ]; then
    echo "⚠️  GH_TOKEN not set, cannot check CI status automatically"
    echo "👉 Please check the GitHub Actions page manually"
else
    # Use GitHub CLI to check status
    if command -v gh &> /dev/null; then
        gh run list --branch $BRANCH_NAME --limit 1
    fi
fi

echo "✅ Test deployment script completed"