# 阶段 3: CI/CD 配置 - 需求文档

**项目**: EscapeKit - Breaking Ralph Loop Inverso  
**阶段**: 阶段 3 - CI/CD 配置  
**日期**: 2025年3月17日  
**状态**: 待实施

---

## 📋 需求概述

### 目标

配置 EscapeKit 项目的 CI/CD 流程，实现自动化测试、构建和部署。重点集成 Railway 平台，提供一键部署体验。

### 成功标准

1. ✅ GitHub Actions CI/CD 流程正常工作
2. ✅ Railway 集成配置完成
3. ✅ 自动化测试在每次提交时运行
4. ✅ 部署流程验证成功
5. ✅ Railway 模板创建完成
6. ✅ 文档更新

---

## 🎯 详细需求

### 1. GitHub Actions 配置

#### 1.1 增强现有 CI 流程

**当前状态**: `.github/workflows/ci.yml` 存在但需要增强

**需要添加的功能**:
- 代码覆盖率报告上传
- 构建产物缓存
- 多 Node.js 版本测试
- 依赖安全扫描

**目标文件**: `.github/workflows/ci.yml`

**实现细节**:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  ci:
    name: Lint, Test & Build
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Test with coverage
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage/coverage-final.json
          flags: unittests
          name: codecov-umbrella

      - name: Build
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: dist-${{ matrix.node-version }}
          path: dist/
          retention-days: 7

      - name: Security audit
        run: npm audit --production
```

#### 1.2 创建 Release 工作流

**目标**: 自动化发布流程

**目标文件**: `.github/workflows/release.yml`

**实现细节**:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  release:
    name: Create Release
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm run test:coverage

      - name: Build
        run: npm run build

      - name: Create tarball
        run: |
          VERSION=$(node -p "require('./package.json').version")
          npm pack
          mv escapekit-mcp-${VERSION}.tgz release.tgz

      - name: Create GitHub Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          draft: false
          prerelease: false

      - name: Upload release asset
        uses: actions/upload-release-asset@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          upload_url: ${{ steps.create_release.outputs.upload_url }}
          asset_path: ./release.tgz
          asset_name: escapekit-mcp-${{ steps.get_version.outputs.version }}.tgz
          asset_content_type: application/gzip
```

---

### 2. Railway 集成

#### 2.1 创建 Railway 配置文件

**目标文件**: `railway.yml`

**实现细节**:

```yaml
version: "1.0"

services:
  # MCP Server Service
  mcp-server:
    buildCommand: npm install && npm run build
    startCommand: node dist/server.js
    env:
      - NODE_ENV=production
      - PORT=3000
    healthcheckPath: /health
    healthcheckTimeout: 100

  # CLI Tool Service (optional - for testing)
  cli-test:
    buildCommand: npm install && npm run build
    startCommand: npm run cli -- --help
    env:
      - NODE_ENV=test

# CI/CD integration
deployments:
  test:
    # Run tests before deploying
    command: npm test
    # Upload results to Kiwi TCMS (optional)
    command: npx ts-node scripts/kiwi-upload.ts --file vitest-results.json --framework vitest
    on:
      branch: [main, develop, feature/*]
```

#### 2.2 创建 Railway 环境变量模板

**目标文件**: `.railway.env.example`

**实现细节**:

```bash
# Railway Environment Variables
# Copy this file and rename to .railway.env
# Set actual values in Railway project settings

# Application Settings
NODE_ENV=production
PORT=3000

# Kiwi TCMS Integration (optional)
KIWI_URL=https://your-kiwi-tcms.com
KIWI_USERNAME=your-api-user
KIWI_PASSWORD=your-api-password
KIWI_PRODUCT_ID=123
KIWI_TEST_PLAN_ID=456

# Railway Configuration
RAILWAY_PROJECT_ID=your-project-id
RAILWAY_SERVICE_ID=your-service-id

# MCP Configuration
MCP_SERVER_HOST=0.0.0.0
MCP_SERVER_PORT=3000
```

#### 2.3 创建 Railway 部署脚本

**目标文件**: `scripts/deploy-to-railway.sh`

**实现细节**:

```bash
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
```

**修改文件权限**:
```bash
chmod +x scripts/deploy-to-railway.sh
```

---

### 3. GitHub Actions + Railway 集成

#### 3.1 创建 Railway 部署工作流

**目标文件**: `.github/workflows/deploy-railway.yml`

**实现细节**:

```yaml
name: Deploy to Railway

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: |
          npm test -- --reporter=json --outputFile=vitest-results.json

      - name: Upload test results
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: vitest-results.json

      - name: Upload coverage
        uses: codecov/codecov-action@v4

  deploy:
    name: Deploy to Railway
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Railway CLI
        run: npm install -g @railway/cli

      - name: Login to Railway
        run: railway login --token ${{ secrets.RAILWAY_TOKEN }}

      - name: Deploy to Railway
        run: railway up --service=mcp-server

      - name: Get Railway URL
        id: railway-url
        run: |
          URL=$(railway domain --service mcp-server)
          echo "url=$URL" >> $GITHUB_OUTPUT

      - name: Comment PR with Railway URL
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '✅ Deployed to Railway: ${{ steps.railway-url.outputs.url }}'
            })
```

---

### 4. Railway 模板创建

#### 4.1 创建 Railway 模板配置

**目标文件**: `railway-template.json`

**实现细节**:

```json
{
  "name": "escapekit-mcp",
  "description": "EscapeKit: Transform AI sandbox code into production-ready projects with CI/CD integration",
  "repository": "https://github.com/escapekit/escapekit-mcp",
  "keywords": [
    "mcp",
    "model-context-protocol",
    "ai",
    "sandbox",
    "code-generation",
    "escape",
    "portability"
  ],
  "envVars": [
    {
      "name": "NODE_ENV",
      "value": "production"
    },
    {
      "name": "PORT",
      "value": "3000"
    }
  ],
  "services": [
    {
      "name": "mcp-server",
      "buildCommand": "npm install && npm run build",
      "startCommand": "node dist/server.js",
      "envVars": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        }
      ]
    }
  ]
}
```

#### 4.2 更新 README.md 添加 Railway 按钮

**目标文件**: `README.md`

**需要添加的内容**:

```markdown
# EscapeKit - Breaking Ralph Loop Inverso

[![Railway](https://img.shields.io/badge/Railway-deploy-blue)](https://railway.app/new/template?template=YOUR_TEMPLATE_ID)
[![CI/CD](https://github.com/escapekit/escapekit-mcp/workflows/CI/badge.svg)](https://github.com/escapekit/escapekit-mcp/actions)
[![codecov](https://codecov.io/gh/escapekit/escapekit-mcp/branch/main/graph/badge.svg)](https://codecov.io/gh/escapekit/escapekit-mcp)

## Quick Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=YOUR_TEMPLATE_ID)

## Features

- ✅ One-click Railway deployment
- ✅ Automated CI/CD with GitHub Actions
- ✅ Comprehensive test coverage
- ✅ Kiwi TCMS integration for test tracking
- ✅ Multi-environment support (dev, staging, prod)
```

---

### 5. 测试验证

#### 5.1 创建测试提交脚本

**目标文件**: `scripts/test-deployment.sh`

**实现细节**:

```bash
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
```

#### 5.2 验证清单

**验证步骤**:

1. **本地验证**:
   ```bash
   # 运行所有测试
   npm test
   
   # 运行 lint
   npm run lint
   
   # 类型检查
   npm run typecheck
   
   # 构建
   npm run build
   ```

2. **GitHub Actions 验证**:
   - 推送到新分支
   - 检查 CI 工作流是否运行
   - 验证所有测试通过
   - 检查代码覆盖率报告

3. **Railway 部署验证**:
   ```bash
   # 运行部署脚本
   ./scripts/deploy-to-railway.sh
   
   # 检查应用是否运行
   curl https://your-app.railway.app/health
   ```

4. **Railway 模板验证**:
   - 创建新 Railway 项目
   - 使用模板部署
   - 验证应用正常运行
   - 检查环境变量配置

---

## 📊 影响文件

### 新增文件

1. `.github/workflows/release.yml` - 发布工作流
2. `.github/workflows/deploy-railway.yml` - Railway 部署工作流
3. `railway.yml` - Railway 配置
4. `.railway.env.example` - Railway 环境变量模板
5. `scripts/deploy-to-railway.sh` - Railway 部署脚本
6. `scripts/test-deployment.sh` - 测试部署脚本
7. `railway-template.json` - Railway 模板配置
8. `.comate/specs/phase3-ci-cd-configuration/doc.md` - 本文档
9. `.comate/specs/phase3-ci-cd-configuration/tasks.md` - 任务列表
10. `.comate/specs/phase3-ci-cd-configuration/summary.md` - 完成总结

### 修改文件

1. `.github/workflows/ci.yml` - 增强 CI 流程
2. `package.json` - 添加新脚本命令
3. `README.md` - 添加 Railway 部署按钮

---

## 🔧 实现细节

### 依赖项

**Node.js 版本**: 18.x, 20.x, 22.x

**新增 npm 依赖**:
- 无需新增依赖

**开发工具**:
- Railway CLI (`@railway/cli`)
- GitHub CLI (`gh`) - 可选

### 环境变量

**GitHub Secrets**:
- `RAILWAY_TOKEN` - Railway API token
- `CODECOV_TOKEN` - Codecov token (可选)
- `GH_TOKEN` - GitHub token (可选，用于自动检查)

**Railway Environment Variables**:
- `NODE_ENV` - 环境 (production/staging/development)
- `PORT` - 应用端口
- `KIWI_URL` - Kiwi TCMS URL (可选)
- `KIWI_USERNAME` - Kiwi TCMS 用户名 (可选)
- `KIWI_PASSWORD` - Kiwi TCMS 密码 (可选)
- `KIWI_PRODUCT_ID` - Kiwi TCMS 产品 ID (可选)
- `KIWI_TEST_PLAN_ID` - Kiwi TCMS 测试计划 ID (可选)

---

## ⚠️ 边界条件与异常处理

### 异常场景处理

1. **GitHub Actions 失败**:
   - 所有失败都会发送通知
   - Pull Request 将被阻止合并
   - 失败的步骤有详细日志

2. **Railway 部署失败**:
   - 部署前运行测试
   - 测试失败则不部署
   - 部署失败时回滚

3. **测试覆盖率下降**:
   - 设置覆盖率阈值 (70%)
   - 低于阈值时 CI 失败
   - 需要审查覆盖率的下降

4. **网络问题**:
   - 超时重试机制
   - 缓存依赖加速构建
   - 超时时间合理设置

---

## 📈 数据流动路径

### CI/CD 流程

```
代码提交
    ↓
GitHub Actions 触发
    ↓
运行测试 (vitest)
    ↓
生成覆盖率报告
    ↓
上传到 Codecov
    ↓
类型检查 (tsc)
    ↓
代码检查 (eslint)
    ↓
构建项目 (tsc)
    ↓
上传构建产物
    ↓
[如果 main 分支]
    ↓
部署到 Railway
    ↓
健康检查
    ↓
完成
```

### Railway 部署流程

```
触发部署 (push main)
    ↓
运行测试
    ↓
[可选] 上传到 Kiwi TCMS
    ↓
构建项目
    ↓
部署到 Railway
    ↓
获取应用 URL
    ↓
通知用户
    ↓
完成
```

---

## 🎯 预期成果

### 交付物

1. ✅ 增强的 GitHub Actions CI/CD 流程
2. ✅ Railway 集成配置文件
3. ✅ Railway 部署脚本
4. ✅ Railway 模板配置
5. ✅ 更新的 README.md
6. ✅ 测试验证脚本
7. ✅ 完整的文档

### 验证标准

1. ✅ GitHub Actions CI/CD 正常运行
2. ✅ 所有测试通过
3. ✅ 代码覆盖率 ≥ 70%
4. ✅ Railway 部署成功
5. ✅ 应用在 Railway 上正常运行
6. ✅ Railway 模板可正常使用
7. ✅ 文档完整且准确

### 性能指标

- CI 流程执行时间: < 5 分钟
- 部署时间: < 3 分钟
- 应用启动时间: < 10 秒

---

## 🚀 后续步骤

完成阶段 3 后，可以：

1. **发布 Pro 版本**
   - 功能验证
   - 文档完善
   - 发布公告

2. **开始阶段 1**
   - LLM 感知推荐
   - 分析真实代码样本
   - 创建 LLM 特定规则

3. **完成 Fase 4**
   - 监控和警报
   - 性能优化
   - 用户反馈循环

---

## ?? 参考资料

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Railway Documentation](https://docs.railway.app/)
- [Railway Templates](https://railway.app/templates)
- [Codecov Documentation](https://docs.codecov.com/)
- [EscapeKit Documentation](https://docs.escapekit.dev/)

---

**文档版本**: 1.0  
**最后更新**: 2025年3月17日  
**状态**: 待用户确认