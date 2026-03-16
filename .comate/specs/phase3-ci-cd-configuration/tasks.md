# 阶段 3: CI/CD 配置 - 任务列表

**项目**: EscapeKit - Breaking Ralph Loop Inverso  
**阶段**: 阶段 3 - CI/CD 配置  
**预计耗时**: 4-6 小时

---

## 任务清单

- [x] 任务 1: 增强 GitHub Actions CI 流程
    - 1.1: 更新 `.github/workflows/ci.yml`，添加多 Node.js 版本测试 (18.x, 20.x, 22.x)
    - 1.2: 添加代码覆盖率报告上传到 Codecov
    - 1.3: 添加构建产物缓存和上传
    - 1.4: 添加类型检查步骤 (`npm run typecheck`)
    - 1.5: 添加生产依赖安全审计 (`npm audit --production`)

- [x] 任务 2: 创建 Release 工作流
    - 2.1: 创建 `.github/workflows/release.yml` 文件
    - 2.2: 配置自动触发条件（推送 tag 如 `v*.*.*`）
    - 2.3: 添加测试和构建步骤
    - 2.4: 添加 npm pack 创建 tarball
    - 2.5: 配置 GitHub Release 创建和资产上传

- [ ] 任务 3: 配置 Railway 集成
    - 3.1: 创建 `railway.yml` 配置文件
    - 3.2: 配置 MCP Server 服务（buildCommand, startCommand, env）
    - 3.3: 配置 CLI Test 服务（可选，用于测试）
    - 3.4: 配置 deployments 测试步骤
    - 3.5: 创建 `.railway.env.example` 环境变量模板

- [ ] 任务 4: 创建 Railway 部署脚本
    - 4.1: 创建 `scripts/deploy-to-railway.sh` 脚本
    - 4.2: 添加 Railway CLI 安装检查
    - 4.3: 添加登录检查和自动登录
    - 4.4: 实现测试运行（带 JSON 输出）
    - 4.5: 实现 Kiwi TCMS 上传（可选）
    - 4.6: 实现构建和部署到 Railway
    - 4.7: 添加可执行权限 (`chmod +x`)

- [ ] 任务 5: 创建 GitHub Actions + Railway 工作流
    - 5.1: 创建 `.github/workflows/deploy-railway.yml` 文件
    - 5.2: 配置 test job（运行测试，上传结果）
    - 5.3: 配置 deploy job（依赖 test，仅在 main 分支运行）
    - 5.4: 添加 Railway CLI 安装和登录
    - 5.5: 实现 Railway 部署
    - 5.6: 添加 Railway URL 获取和 PR 评论

- [ ] 任务 6: 创建 Railway 模板配置
    - 6.1: 创建 `railway-template.json` 文件
    - 6.2: 配置模板元数据（name, description, repository, keywords）
    - 6.3: 配置环境变量（NODE_ENV, PORT）
    - 6.4: 配置服务定义（mcp-server）
    - 6.5: 验证 JSON 格式正确

- [x] 任务 7: 更新 README.md 添加 Railway 按钮
    - 7.1: 在 README.md 顶部添加 Railway 和 CI/CD 徽章
    - 7.2: 添加 "Quick Deploy to Railway" 章节
    - 7.3: 添加 Railway 部署按钮 SVG
    - 7.4: 更新 Features 列表，添加 CI/CD 相关特性

- [x] 任务 8: 创建测试部署脚本
    - 8.1: 创建 `scripts/test-deployment.sh` 脚本
    - 8.2: 实现创建测试分支逻辑
    - 8.3: 添加小的测试更改并提交
    - 8.4: 实现推送到远程仓库
    - 8.5: 添加等待 CI 完成逻辑
    - 8.6: 添加 CI 状态检查（使用 gh CLI）
    - 8.7: 添加可执行权限

- [x] 任务 9: 本地验证测试
    - 9.1: 运行所有测试 (`npm test`)
    - 9.2: 运行 lint (`npm run lint`)
    - 9.3: 运行类型检查 (`npm run typecheck`)
    - 9.4: 运行构建 (`npm run build`)
    - 9.5: 验证构建产物在 dist/ 目录

- [ ] 任务 10: GitHub Actions 验证
    - 10.1: 创建新的功能分支
    - 10.2: 推送测试提交到新分支
    - 10.3: 检查 GitHub Actions CI 工作流是否触发
    - 10.4: 验证所有测试通过
    - 10.5: 检查代码覆盖率报告上传
    - 10.6: 验证构建产物上传成功

- [ ] 任务 11: Railway 部署验证
    - 11.1: 运行 `scripts/deploy-to-railway.sh` 脚本
    - 11.2: 验证测试运行并生成 JSON 结果
    - 11.3: 验证 Kiwi TCMS 上传（如果配置）
    - 11.4: 验证 Railway 部署成功
    - 11.5: 获取并记录 Railway 应用 URL
    - 11.6: 使用 curl 测试应用健康检查端点
    - 11.7: 验证应用正常运行并响应请求

- [ ] 任务 12: Railway 模板验证
    - 12.1: 登录 Railway 控制台
    - 12.2: 创建新 Railway 项目
    - 12.3: 使用 `railway-template.json` 模板部署
    - 12.4: 配置环境变量（参考 `.railway.env.example`）
    - 12.5: 启动部署并监控日志
    - 12.6: 验证应用启动成功
    - 12.7: 测试应用功能是否正常

- [ ] 任务 13: 更新 package.json 脚本
    - 13.1: 添加 `deploy:railway` 脚本（调用 deploy-to-railway.sh）
    - 13.2: 添加 `test:deployment` 脚本（调用 test-deployment.sh）
    - 13.3: 验证所有脚本名称正确
    - 13.4: 测试新添加的脚本

- [ ] 任务 14: 文档更新和清理
    - 14.1: 创建 `.comate/specs/phase3-ci-cd-configuration/summary.md` 总结文档
    - 14.2: 更新 CHANGELOG.md 记录 CI/CD 配置变更
    - 14.3: 更新 CONTRIBUTING.md 添加 CI/CD 流程说明
    - 14.4: 检查并删除临时测试文件（如 TEST_DEPLOY.md）
    - 14.5: 验证所有文档链接正确

- [ ] 任务 15: 创建提交和发布
    - 15.1: 审查所有更改（`git status`, `git diff`）
    - 15.2: 创建功能分支（如 `feature/ci-cd-configuration`）
    - 15.3: 提交所有更改（使用清晰的提交信息）
    - 15.4: 推送到远程仓库
    - 15.5: 创建 Pull Request 到 main 分支
    - 15.6: 等待 CI/CD 验证通过
    - 15.7: 合并 PR 到 main 分支
    - 15.8: 创建 GitHub Release（版本 2.1.0-beta.1）

---

## 任务优先级

### 高优先级（必须完成）
- 任务 1: 增强 GitHub Actions CI 流程
- 任务 3: 配置 Railway 集成
- 任务 4: 创建 Railway 部署脚本
- 任务 5: 创建 GitHub Actions + Railway 工作流
- 任务 9: 本地验证测试
- 任务 10: GitHub Actions 验证
- 任务 11: Railway 部署验证

### 中优先级（重要）
- 任务 2: 创建 Release 工作流
- 任务 6: 创建 Railway 模板配置
- 任务 7: 更新 README.md 添加 Railway 按钮
- 任务 8: 创建测试部署脚本
- 任务 13: 更新 package.json 脚本

### 低优先级（可选）
- 任务 12: Railway 模板验证（可以在后续完成）
- 任务 14: 文档更新和清理
- 任务 15: 创建提交和发布

---

## 依赖关系

```
任务 1 → 任务 9
任务 2 → 任务 15
任务 3 → 任务 4
任务 4 → 任务 11
任务 5 → 任务 10
任务 6 → 任务 12
任务 7 → 任务 15
任务 8 → 任务 10
任务 9 → 任务 10
任务 10 → 任务 11
任务 11 → 任务 12
任务 13 → 任务 15
任务 14 → 任务 15
```

---

## 预期时间线

| 任务 | 预计时间 | 依赖 |
|------|---------|------|
| 任务 1 | 1 小时 | 无 |
| 任务 2 | 45 分钟 | 无 |
| 任务 3 | 30 分钟 | 无 |
| 任务 4 | 45 分钟 | 任务 3 |
| 任务 5 | 45 分钟 | 任务 4 |
| 任务 6 | 30 分钟 | 无 |
| 任务 7 | 20 分钟 | 任务 6 |
| 任务 8 | 30 分钟 | 任务 5 |
| 任务 9 | 15 分钟 | 任务 1 |
| 任务 10 | 1 小时（含等待） | 任务 9 |
| 任务 11 | 30 分钟 | 任务 10 |
| 任务 12 | 30 分钟 | 任务 11 |
| 任务 13 | 15 分钟 | 无 |
| 任务 14 | 30 分钟 | 无 |
| 任务 15 | 30 分钟 | 所有前续任务 |

**总计**: ~6 小时

---

## 成功标准

### 技术标准
- ✅ 所有 GitHub Actions 工作流正常运行
- ✅ 代码覆盖率 ≥ 70%
- ✅ Railway 部署成功
- ✅ 应用在 Railway 上正常运行
- ✅ Railway 模板可正常使用

### 质量标准
- ✅ 所有测试通过
- ✅ 代码检查通过
- ✅ 类型检查通过
- ✅ 文档完整且准确

### 性能标准
- ✅ CI 流程执行时间 < 5 分钟
- ✅ 部署时间 < 3 分钟
- ✅ 应用启动时间 < 10 秒

---

## 备注

1. **Railway Token**: 需要在 GitHub Secrets 中配置 `RAILWAY_TOKEN`
2. **Codecov Token**: 可选，但建议配置 `CODECOV_TOKEN` 用于代码覆盖率追踪
3. **Kiwi TCMS**: 集成是可选的，如果不需要可以跳过相关配置
4. **测试分支**: 建议在单独的功能分支进行开发和测试
5. **清理**: 完成后记得清理测试分支和临时文件

---

**任务列表版本**: 1.0  
**最后更新**: 2025年3月17日  
**状态**: 待用户确认
