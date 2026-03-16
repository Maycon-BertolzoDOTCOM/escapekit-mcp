#!/bin/bash

set -e

echo "🚀 Starting Railway deployment..."

# Set Railway project
export RAILWAY_PROJECT_ID="${RAILWAY_PROJECT_ID:-your-project-id}"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null
then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Login to Railway (if needed)
if ! railway whoami &> /dev/null; then
    echo "🔐 Please login to Railway..."
    railway login
fi

# Run tests
echo "🧪 Running tests..."
npm test -- --reporter=json --outputFile=vitest-results.json

# Upload to Kiwi TCMS (optional)
if [ -n "$KIWI_URL" ]; then
    echo "📊 Uploading results to Kiwi TCMS..."
    npx ts-node scripts/kiwi-upload.ts \
        --file vitest-results.json \
        --framework vitest \
        --verbose || echo "⚠️  Kiwi TCMS upload failed, continuing..."
fi

# Build project
echo "🔨 Building project..."
npm run build

# Deploy to Railway
echo "🚀 Deploying to Railway..."
railway up --service=mcp-server

echo "✅ Deployment completed!"
echo "🌐 Application URL: $(railway domain --service mcp-server)"