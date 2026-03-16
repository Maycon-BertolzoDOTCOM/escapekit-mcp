# 需求文档 - Kiwi TCMS Sprint 3 Fase 3: CI/CD Configuration

## 需求背景

Fase 2 已成功实现了测试结果加载功能（Vitest、Mocha、Custom），现在需要将这些功能集成到 CI/CD 管道中，实现自动化测试结果上报到 Kiwi TCMS。

## 核心需求

### 1. GitHub Actions Workflow

**需求描述**
创建 GitHub Actions workflow，在每次 push 或 pull request 时自动运行测试，并将结果上传到 Kiwi TCMS。

**处理逻辑**
1. 检测到代码提交或 PR 时触发 workflow
2. 运行测试套件（Vitest/Mocha/Jest 等）
3. 生成测试结果文件（JSON/XML）
4. 调用 `load-test-results.ts` 脚本加载结果
5. 通过 Kiwi TCMS API 上传结果
6. 在 PR 中显示测试摘要
7. 失败时创建 issue 或注释

**架构技术方案**
- GitHub Actions YAML 配置
- 使用环境变量存储 Kiwi TCMS 凭据
- 复用现有的 `scripts/load-test-results.ts`
- 添加 GitHub Actions 特定的输出格式

**影响文件**
- 新建: `.github/workflows/kiwi-tcms.yml`
- 新建: `scripts/kiwi-upload.ts`（专门的上传脚本）
- 新建: `examples/ci/github-actions-example.md`

**实现细节**

```yaml
# .github/workflows/kiwi-tcms.yml
name: Kiwi TCMS Integration
on: [push, pull_request]

jobs:
  test-and-report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test -- --reporter=json --output=test-results.json
      
      - name: Upload to Kiwi TCMS
        env:
          KIWI_URL: ${{ secrets.KIWI_URL }}
          KIWI_USERNAME: ${{ secrets.KIWI_USERNAME }}
          KIWI_PASSWORD: ${{ secrets.KIWI_PASSWORD }}
        run: npx ts-node scripts/kiwi-upload.ts --file=test-results.json
      
      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            // 读取测试结果并生成 PR 注释
```

**边界条件与异常处理**
- Kiwi TCMS API 不可用时重试（最多 3 次）
- 环境变量缺失时跳过上传并警告
- 测试结果文件不存在时优雅降级
- 网络超时处理（30s）

**数据流动路径**
```
Git Push → GitHub Actions → npm test → test-results.json → 
load-test-results.ts → kiwi-upload.ts → Kiwi TCMS API → Dashboard
```

**预期成果**
- GitHub Actions workflow 自动运行
- 测试结果自动上传到 Kiwi TCMS
- PR 中显示测试摘要
- 失败时创建 issue

---

### 2. GitLab CI Template

**需求描述**
创建 GitLab CI 模板，支持 GitLab 用户集成 Kiwi TCMS。

**处理逻辑**
与 GitHub Actions 类似，但适配 GitLab CI 语法和特性：
1. 在 `.gitlab-ci.yml` 中配置 stages
2. 测试阶段生成结果文件
3. 报告阶段上传到 Kiwi TCMS
4. 使用 GitLab artifacts 存储结果
5. 在 Merge Request 中显示测试报告

**架构技术方案**
- GitLab CI YAML 配置
- GitLab CI/CD Variables 存储凭据
- 复用 `scripts/kiwi-upload.ts`
- GitLab Merge Request 注释 API

**影响文件**
- 新建: `.gitlab-ci.yml`
- 新建: `examples/ci/gitlab-ci-example.md`

**实现细节**

```yaml
# .gitlab-ci.yml
stages:
  - test
  - report

test:
  stage: test
  image: node:18
  script:
    - npm ci
    - npm test -- --reporter=json --output=test-results.json
  artifacts:
    paths:
      - test-results.json
    expire_in: 1 week

report:
  stage: report
  image: node:18
  dependencies:
    - test
  script:
    - npx ts-node scripts/kiwi-upload.ts --file=test-results.json
  only:
    - main
    - merge_requests
```

**边界条件与异常处理**
- GitLab CI 变量验证
- Artifacts 过期处理
- Merge Request API 认证失败处理

**预期成果**
- GitLab CI pipeline 自动运行
- 测试结果自动上传
- MR 中显示测试报告

---

### 3. 本地执行支持

**需求描述**
完善本地执行支持，提供 CLI 工具和文档，方便开发者在本地测试集成。

**处理逻辑**
1. 提供 npm script 快捷命令
2. 支持环境变量配置文件（.env）
3. 本地验证上传前的测试结果
4. 详细的日志输出

**架构技术方案**
- 使用 `commander.js` 构建 CLI
- `.env` 文件支持
- 交互式配置向导（可选）

**影响文件**
- 新建: `scripts/kiwi-cli.ts`
- 修改: `package.json`（添加 scripts）
- 新建: `.env.example`
- 新建: `docs/local-development.md`

**实现细节**

```json
// package.json
{
  "scripts": {
    "test:upload": "ts-node scripts/kiwi-cli.ts upload",
    "test:upload:dry": "ts-node scripts/kiwi-cli.ts upload --dry-run"
  }
}
```

**边界条件与异常处理**
- .env 文件缺失时提示创建
- 网络错误时提供重试选项
- 配置验证失败时给出详细错误信息

**预期成果**
- `npm run test:upload` 上传测试结果
- `npm run test:upload:dry` 验证配置
- 清晰的错误提示和配置指南

---

### 4. CI/CD 集成文档

**需求描述**
创建完整的 CI/CD 集成文档。

**架构技术方案**
- Markdown 文档
- 代码示例和配置文件
- 故障排除指南

**影响文件**
- 新建: `docs/ci-cd-integration.md`
- 新建: `examples/ci/README.md`

**预期成果**
- 完整的集成文档
- 分步配置指南
- 常见问题解决方案

## 预期成果

- ✅ GitHub Actions workflow
- ✅ GitLab CI pipeline
- ✅ 本地 CLI 工具
- ✅ 完整的集成文档
- ✅ 测试结果自动上传
- ✅ PR/MR 测试摘要
