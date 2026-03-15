# EscapeKit MCP - 需求文档 (PRD v2.1)

**版本**: 2.1  
**日期**: 2026-03-13  
**作者**: 基于 Ralph Loop Inverso 理论框架

**产品副标题**: EscapeKit: Breaking Ralph Loop Inverso - 将代码从 AI 金笼中解放出来

## 1. 执行摘要

### 1.1 核心问题：Ralph Loop Inverso 的陷阱

AI 生成式平台（Google AI Studio、Bolt.new、Replit）提供近乎无限且免费的开发环境。然而，它们创建了一种反向的系统依赖，用户（开发者）为了维持平台生态系统而工作。这些平台生成的代码通常包含：

- **幽灵依赖（Ghost Dependencies）**: 公共注册表中不存在的包
- **模拟 API（Mock APIs）**: 仅在沙箱中工作的 API
- **不现实的性能假设**: 假设无限资源、无限带宽等

当尝试将代码迁移到生产环境（沙箱之外）时，开发者面临"无限调试"困境，最终花费更多时间和资源，常常放弃或成为平台基础设施的付费客户（锁定）。我们将这种现象称为"**Ralph Loop Inverso**"：用户成为维持系统的资源，而非相反。

### 1.2 解决方案：EscapeKit MCP

EscapeKit MCP 是一套工具集（MCP servers、CLI、库），用于分析、诊断和转换沙箱环境中生成的 AI 代码，使其成为可在任何真实运行时（Vercel、AWS、自建服务器）中运行的可移植、健壮、生产就绪的代码。它充当"现实编译器"，揭示并修正沙箱的幻觉。

### 1.3 为何现在是最佳时机

**危机与信任问题**: Google AI Studio 用户关于导出数据和代码困难的报告正在增长。

**企业需求**: 67% 的组织希望避免对单一 AI 提供商的依赖。

**MCP 生态系统扩展**: Anthropic 的 Model Context Protocol 正成为 AI 助手与工具集成的标准，允许我们的工具被 Cursor、Windsurf、Claude Desktop 等 IDE 使用。

**竞争空白**: 市场上没有任何工具专门聚焦于"AI 沙箱逃离"。TestSprite 等工具专注于测试，而非转换和可移植性。

### 1.4 成功指标与测量方法

#### 1.4.1 技术指标

| 指标 | 目标 | 测量方法 | 时间线 |
|------|------|----------|--------|
| 迁移成功率 | >85% | 用户运行生成的项目后无错误的比例 | MVP 后 3 个月 |
| 平均迁移时间 | <2 小时 | 从分析到验证通过的总时间（vs 手动调试 2 周基线） | MVP 后 3 个月 |
| 幽灵导入检测精度 | >95% | 检测的幽灵导入中实际不存在的比例（精确度） | MVP 后 1 个月 |
| 假阳性率 | <5% | 标记为幽灵但实际存在的包（通过 npm/PyPI 验证） | MVP 后 1 个月 |
| 分析性能 | <30 秒/1000 行 | 使用标准化测试集测量 | MVP 发布时 |

#### 1.4.2 用户增长指标

| 指标 | 目标 | 时间线 |
|------|------|--------|
| 首月活跃用户 | 1,000 MAU | 发布后 1 个月 |
| 3 个月活跃用户 | 5,000 MAU | 发布后 3 个月 |
| 企业线索 | 50+ qualified leads | 发布后 3 个月 |
| NPS (净推荐值) | >50 | 发布后 6 个月 |

#### 1.4.3 社区指标

| 指标 | 目标 | 时间线 |
|------|------|--------|
| GitHub Stars | 500 | 发布后 1 个月 |
| Contributors | 20+ | 发布后 3 个月 |
| 社区提交的 Polyfills | 10+ | 发布后 3 个月 |
| 文档语言版本 | 3+ (EN, PT, ZH) | 发布后 6 个月 |

### 1.5 集成生态系统

#### 1.5.1 支持 AI 工具（优先级排序）

**核心集成**（MCP 原生支持）:
- **Claude Desktop** - Anthropic 官方客户端，深度集成
- **Cursor** - AI-first IDE，已内置 MCP 支持
- **Windsurf** - Codeium 的 AI 编辑器，MCP 兼容

**扩展集成**（插件或适配器）:
- **GitHub Copilot** - 通过 VS Code 扩展集成
- **Continue.dev** - 开源 AI 助手，支持 MCP 协议
- **JetBrains AI** - 通过 JetBrains 插件
- **Zed Editor** - 原生 MCP 支持（计划中）
- **Bolt.new** - 作为预集成工具提供"Export to Real World"功能

#### 1.5.2 部署平台支持

**优先级 1**（MVP）:
- Vercel - Next.js 首选
- Netlify - 静态站点支持
- 本地开发（Node.js, Docker）

**优先级 2**（阶段 2）:
- AWS Lambda
- Google Cloud Functions
- Deno Deploy
- Railway

**优先级 3**（企业版）:
- Kubernetes（Helm charts）
- AWS ECS/Fargate
- Azure Container Apps

---

## 2. 商业模式

### 2.1 定价策略

#### 2.1.1 免费版（Community）

**目标**: 吸引用户，建立社区，收集反馈

**功能**:
- ✅ 基础代码分析（最多 10 个文件/次）
- ✅ 幽灵导入检测
- ✅ Next.js 项目生成
- ✅ 基础 polyfills（WebGL fallback）
- ✅ 本地验证
- ✅ 社区支持（GitHub Issues）
- ✅ 单用户许可

**限制**:
- ❌ 每月最多 50 次分析
- ❌ 不支持 Python
- ❌ 不支持多沙箱平台（仅 AI Studio）
- ❌ 无持续监控
- ❌ 无 SLA

#### 2.1.2 专业版（Pro）- $19/月

**目标**: 独立开发者和小团队

**功能**（包含免费版所有功能）:
- ✅ 无限分析次数
- ✅ Python 代码支持
- ✅ 多沙箱平台（AI Studio, Bolt, Replit）
- ✅ 高级 polyfills（SwiftShader WASM, 自定义 polyfill 市场）
- ✅ CI/CD 集成（GitHub Actions 模板）
- ✅ 云端验证（Vercel Preview Deployments）
- ✅ 优先支持（24h 响应）
- ✅ 5 用户团队许可

#### 2.1.3 团队版（Team）- $79/月（5 用户）

**目标**: 小型代理机构和创业公司

**功能**（介于专业版和企业版之间）:
- ✅ 专业版所有功能
- ✅ 10 用户团队许可
- ✅ 共享项目空间
- ✅ 团队协作功能
- ✅ 基础审计日志
- ✅ Slack/Discord 集成

#### 2.1.4 企业版（Enterprise）- 定价协商

**目标**: 中大型企业，需要合规和支持

**功能**（包含专业版所有功能）:
- ✅ 无限用户
- ✅ 私有部署（on-premise 或 VPC）
- ✅ SSO（SAML, Okta, Azure AD）
- ✅ 审计日志和合规报告
- ✅ 自定义沙箱适配器
- ✅ 专属客户成功经理
- ✅ 99.9% SLA
- ✅ 4h 紧急响应
- ✅ 培训和 onboarding
- ✅ 持续监控和告警
- ✅ 合规认证（SOC 2, GDPR）

### 2.2 收入预测（保守估计）

| 时间线 | 免费用户 | 付费用户 | 企业客户 | 月经常性收入（MRR） |
|--------|----------|----------|----------|---------------------|
| 3 个月 | 3,000 | 150 | 2 | $4,500 |
| 6 个月 | 8,000 | 400 | 5 | $12,500 |
| 12 个月 | 20,000 | 1,200 | 15 | $45,000 |
| 24 个月 | 50,000 | 3,500 | 40 | $140,000 |

### 2.3 市场进入策略

**阶段 1: Product-Led Growth（0-6 个月）**
- 免费版为核心，功能完整但有限制
- 通过 GitHub、Twitter、Reddit、Hacker News 获客
- 与 AI 工具创作者合作（Cursor、Windsurf 内置推荐）

**阶段 2: Content Marketing（6-12 个月）**
- 发布"Ralph Loop Inverso"理论白皮书
- 制作视频教程和案例研究
- 在技术会议（KubeCon, AI Dev Summit）演讲

**阶段 3: Enterprise Sales（12-24 个月）**
- 雇佣企业销售团队
- 与 CTO 和技术负责人建立关系
- 提供定制化 PoC

---

## 3. 产品概览

### 3.1 目标受众

- **独立开发者和代理机构**: 使用 AI 工具进行快速原型设计，需要将代码投入生产
- **企业**: 内部采用生成式 AI，需要确保生成代码的可移植性和安全性
- **编程教育平台**: 希望教授最佳实践而不创建对特定工具的依赖

### 3.2 产品定位

> "EscapeKit：将您的代码从 AI 的金笼中解放出来。将沙箱原型转化为面向真实世界的生产就绪软件。"

### 3.3 核心功能（高层级）

1. **源代码分析**: 检测沙箱依赖模式、幽灵导入、模拟 API 和不现实假设
2. **可移植代码生成**: 转换代码使其可在真实运行时（Node.js、Python、Deno、Vercel Edge 等）中执行，包括添加回退机制和 polyfills
3. **项目工件生成**: 创建 package.json、Dockerfile、CI/CD 配置和文档
4. **真实运行时验证**: 在真实环境（localhost 或 Docker 容器）中执行自动化测试
5. **持续监控**: 跟踪生产代码并在其开始"回退"到沙箱行为时发出警报

---

## 4. 架构设计

### 4.1 高层架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ESCAPEKIT MCP ECOSYSTEM                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                     │
                    ▼                                     ▼
┌───────────────────────────────┐             ┌───────────────────────────────┐
│        CLIENTES (入口)         │             │        MCP SERVER CORE        │
│  ┌─────────────────────────┐   │             │  ┌─────────────────────────┐  │
│  │ AI Studio, Bolt.new,    │   │             │  │     Orquestrador        │  │
│  │ Replit, Cursor, VS Code │   │             │  │  (管理流程)              │  │
│  └───────────┬─────────────┘   │             │  └───────────┬─────────────┘  │
│              │ (代码)          │             │              │                 │
│              ▼                  │             │              ▼                 │
│  ┌─────────────────────────┐   │             │  ┌─────────────────────────┐  │
│  │    CLI 接口             │   │             │  │   专业模块              │  │
│  │    (Commander.js)       │◄──┼─────────────┼──┤                         │  │
│  └───────────┬─────────────┘   │             │  │ ┌─────┐ ┌─────┐ ┌─────┐│  │
│              │ (命令)          │             │  │ │Parser│ │Ana- │ │Trans││  │
│              ▼                  │             │  │ │      │ │lyzer│ │former││  │
│  ┌─────────────────────────┐   │             │  │ └─────┘ └─────┘ └─────┘│  │
│  │    IDE 接口 (MCP)        │   │             │  └───────────┬─────────────┘  │
│  │    (Cursor, Claude)      │◄──┼─────────────┼──────────────┘                 │
│  └─────────────────────────┘   │             │                                 │
└───────────────────────────────┘             └───────────────────────────────┘
                                                              │
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TRANSFORMATION LAYER                                 │
│  ┌─────────────────────────┐     ┌─────────────────────────┐                │
│  │  Project Generator      │     │    Polyfill Generator    │                │
│  │  (Node, Python, etc.)   │     │  (WebGL, API resilience) │                │
│  └───────────┬─────────────┘     └───────────┬─────────────┘                │
│              │                                │                              │
│              ▼                                ▼                              │
│  ┌─────────────────────────┐     ┌─────────────────────────┐                │
│  │ Infra Generator        │     │   Runtime Validator     │                │
│  │ (Docker, Vercel, CI/CD) │     │   (本地 E2E 测试)        │                │
│  └─────────────────────────┘     └─────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
                                                              │
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GENERATED OUTPUTS                                  │
│  ┌─────────────────────────┐     ┌─────────────────────────┐                │
│  │ Portable Code +         │     │ Escape Contract         │                │
│  │ Real Dependencies       │     │ (YAML with diagnosis)   │                │
│  └─────────────────────────┘     └─────────────────────────┘                │
│  ┌─────────────────────────┐     ┌─────────────────────────┐                │
│  │ Deploy Config           │     │   Validation Report      │                │
│  │ (Vercel, Docker, etc.)  │     │   (Tests passed?)        │                │
│  └─────────────────────────┘     └─────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 详细组件说明

#### 4.2.1 MCP Server Core

**技术选择**: TypeScript/Node.js + Photon Skill（SDK 官方推荐）

**功能**: 接收来自客户端（CLI 或 IDE）的请求，编排分析、转换和生成流程

**MCP Tools 接口**:
- `analyze_sandbox_code(code, sandbox_type, target_runtime) → AnalysisResult`
- `generate_escape_kit(analysis_id, options) → EscapeKit`
- `validate_reality(kit_id, environment) → ValidationReport`
- `continuous_escape_monitoring(production_url, kit_id) → MonitoringSession` (未来功能)

#### 4.2.2 Parsers（按沙箱分类）

**输入**: 源代码、沙箱类型、语言

**输出**: 通用 AST（标准化数据结构）和沙箱特定元数据（如版本、检测到的模式）

**实现**: 使用 Tree-sitter（支持多语言）生成 AST。为每个沙箱创建专门的解析器：

- **AI Studio**: 检测"魔法"导入模式（如无需安装的 `@google/generative-ai`）、WebGL 模拟等
- **Bolt.new**: 识别特定包装器和项目配置
- **Replit**: 检测 Replit 环境的隐式依赖
- **Universal (fallback)**: 对于未列出的沙箱，进行导入和 API 的通用分析

#### 4.2.3 Analyzers（分析器）

**Ghost Imports Detector**:
- 遍历 AST，收集所有导入
- 查询公共注册表（npm registry、PyPI JSON API）验证存在性
- 如果包未找到且不是原生模块，则归类为"ghost"

**Mock APIs Detector**:
- 搜索模拟 API 的代码模式（如 mock URL 的 fetch、模拟延迟的 setTimeout、硬编码数据）
- 与真实 API 的已知签名进行比较

**Infinite Assumptions Detector**:
- 识别无退出条件的循环、无基础的递归调用、无限制的大规模内存分配等

**Security Risk Detector**:
- 扫描常见漏洞（使用 eval、依赖注入、硬编码凭据）

#### 4.2.4 Transformers（转换器）

**Reality Polyfills**:
- 添加使用真实资源模拟沙箱"魔法"行为的代码
- 示例：如果沙箱模拟了 WebGL，polyfill 可以尝试加载 Three.js，如果 WebGL 不可用则回退到静态图片

**Dependency Resolver**:
- 将幽灵导入映射到真实替代品（如 `@splinetool/viewer` → `@splinetool/react-spline`）
- 生成 package.json 或 requirements.txt 的依赖列表

**WASM Bridge**:
- 对于需要高性能的功能（如物理模拟），生成到编译的 WebAssembly 代码的桥接

#### 4.2.5 Generators（生成器）

**Node/Python Project Generator**:
- 创建目录结构、带有已解析依赖的 package.json、包含转换后代码的 index.js 或 main.py

**Infra Generator**:
- 生成本地执行的 Dockerfile 和 docker-compose.yml
- 生成 Vercel（vercel.json）或 Netlify 的配置
- 生成自动化测试的 GitHub Actions 工作流

**Escape Contract Generator**:
- 创建 YAML 文件（契约），记录所有检测到的"魔法"和应用的修正。作为项目的活文档

#### 4.2.6 Runtime Validator（运行时验证器）

- 使用 Playwright（浏览器测试）和 child_process（服务器测试）在受控环境（localhost 或 Docker 容器）中执行生成的代码
- 验证页面是否加载、API 是否响应、WebGL 是否工作（或回退是否激活）、控制台无错误
- 返回包含截图、日志和性能指标的详细报告

### 4.3 推荐技术栈

| 组件 | 技术 | 理由 |
|------|------|------|
| 主语言 | TypeScript/Node.js | CLI 工具和 MCP 集成的成熟生态系统 |
| MCP 框架 | Photon Skill (TS) | 保持 TypeScript 技术栈统一 |
| 解析 | Tree-sitter | 原生支持多语言、高效且精确 |
| 包分析 | npm-registry-client, pypi-json | 实时查询注册表 |
| 代码转换 | Babel (JS/TS), jscodeshift | 成熟的 AST 操作工具 |
| CLI | Commander.js + Ink (React for CLI) | 丰富的界面、易于开发 |
| 测试 | Vitest (单元), Playwright (E2E) | 行业标准 |
| 容器化 | Dockerode (程序化容器控制) | 允许启动干净的测试环境 |

---

## 5. 用户流程

### 5.1 主要流程：分析和生成 Kit

```
[用户]                                            [EscapeKit MCP]
    |                                                        |
    | 1. 提供沙箱代码 (通过 CLI/IDE)                         |
    |------------------------------------------------------->|
    |                                                        |
    |                                  2. 解析代码 (检测沙箱) |
    |                                                        |
    |                                  3. 执行分析器:        |
    |                                     - Ghost imports    |
    |                                     - Mock APIs        |
    |                                     - Infinite assumptions
    |                                                        |
    |                                  4. 返回 AnalysisResult|
    | <-------------------------------------------------------|
    |                                                        |
    | 5. 用户审查报告 (发现的问题)                          |
    |                                                        |
    | 6. 请求生成 kit (带选项)                               |
    |------------------------------------------------------->|
    |                                                        |
    |                                  7. 执行转换器          |
    |                                  8. 生成工件:           |
    |                                     - 可移植代码         |
    |                                     - package.json      |
    |                                     - Dockerfile        |
    |                                     - 契约 YAML         |
    |                                  9. 返回 EscapeKit     |
    | <-------------------------------------------------------|
    |                                                        |
    | 10. 用户执行 kit (npm install && npm run dev)          |
    |     或进行部署                                         |
    |                                                        |
```

### 5.2 自动验证流程

```
[用户]                                            [EscapeKit MCP]
    |                                                        |
    | 1. 执行 "escapekit validate <kit-id>"                 |
    |------------------------------------------------------->|
    |                                                        |
    |                                  2. 启动测试环境        |
    |                                     (本地 Docker 或 VM)|
    |                                  3. 执行测试:          |
    |                                     - 项目构建         |
    |                                     - HTTP health check|
    |                                     - E2E 测试 (Playwright)
    |                                  4. 返回报告          |
    | <-------------------------------------------------------|
    |                                                        |
    | 5. 用户查看代码在真实世界中是否工作                   |
    |                                                        |
```

---

## 6. 详细功能需求

| ID | 模块 | 需求 | 优先级 |
|----|------|------|--------|
| RF-01 | Parser | 必须支持 JavaScript/TypeScript 和 Python 代码解析 | 高 |
| RF-02 | Parser | 必须根据代码模式自动识别沙箱类型（如 @google/generative-ai 的存在） | 中 |
| RF-03 | Analyzer | 必须检测 npm 或 PyPI 中不存在的包导入并建议替代方案 | 高 |
| RF-04 | Analyzer | 必须检测模拟 API 调用（如 localhost 的 fetch 或 mock 数据）并建议真实端点 | 高 |
| RF-05 | Analyzer | 必须检测无限循环或潜在无结束的操作（如无 break 的 while(true)） | 中 |
| RF-06 | Analyzer | 必须检测安全漏洞（如用户输入的 eval） | 中 |
| RF-07 | Transformer | 必须用真实包的导入替换幽灵导入（当可能时）或生成错误和说明 | 高 |
| RF-08 | Transformer | 必须为可能不可用的功能添加回退机制（如 WebGL → canvas 2D → 静态图片） | 高 |
| RF-09 | Generator | 必须生成完整且可用的 package.json 或 requirements.txt | 高 |
| RF-10 | Generator | 必须为项目生成优化的 Dockerfile | 中 |
| RF-11 | Generator | 必须生成"逃离契约"（YAML）文档记录所有更改和假设 | 高 |
| RF-12 | CLI | 必须提供 analyze、generate、validate、monitor 命令 | 高 |
| RF-13 | MCP Server | 必须将所有功能作为 MCP 工具暴露以集成 IDE | 高 |
| RF-14 | Validator | 必须在 Docker 化环境中执行 E2E 测试并返回报告 | 高 |

## 7. 非功能需求

| ID | 需求 | 描述 | 指标 |
|----|------|------|------|
| RNF-01 | Performance | 最多 1000 行的项目分析应在 <30 秒内完成 | 平均响应时间 |
| RNF-02 | Precision | 幽灵导入检测的假阳性率 <5% | 精确度和召回率 |
| RNF-03 | Usability | CLI 应有清晰的帮助和可理解的错误消息 | 用户反馈 |
| RNF-04 | Security | 未经明确同意，不得将用户数据发送到外部服务器 | 代码审计 |
| RNF-05 | Portability | 生成的 kit 必须在 Windows、macOS 和 Linux 上工作 | 平台测试 |
| RNF-06 | Extensibility | 应易于通过插件添加新沙箱和语言支持 | 文档和示例 |

---

## 8. 实施路线图

### 8.1 阶段 1：MVP（4-6 周）

**目标**: 支持 Google AI Studio（JS/TS 代码）并生成基本 Node.js 项目

**交付物**:
- AI Studio Parser
- Ghost Imports Analyzer
- 替换幽灵导入的 Transformer（手动映射时）
- Node.js 项目生成器（package.json + 转换后代码）
- 带 analyze 和 generate 命令的 CLI

**成功标准**: 3 个真实的 AI Studio 项目成功迁移到 Vercel

### 8.2 阶段 2：扩展（4-6 周）

**目标**: 添加 Bolt.new、Replit 和 Python 语言支持

**交付物**:
- Bolt.new 和 Replit Parsers
- Mock APIs Analyzer
- Python 项目生成器
- Dockerfile 生成
- validate 工具（本地验证）

**成功标准**: 支持 10+ 沙箱，100 名活跃用户

### 8.3 阶段 3：优化和社区（持续）

**目标**: 提高精确度、添加高级 polyfills、开放贡献

**交付物**:
- WebGL Polyfills（通过 WASM 的 SwiftShader）
- Infinite Assumptions Analyzer
- 监控 Web Dashboard（可选）
- 贡献者文档

**成功标准**: 社区项目创建，NPS > 50

### 8.4 阶段 4：企业版（可选）

**目标**: 提供付费版本，包含持续监控、SLA 和支持

**交付物**:
- 生产 monitor 工具
- 企业 CI/CD 集成（Jenkins、GitLab CI）
- 管理面板

**成功标准**: 5 个企业付费客户

---

## 9. 开源贡献指南

### 9.1 CONTRIBUTING.md 草稿

```markdown
# Contributing to EscapeKit MCP

感谢您对 EscapeKit MCP 的兴趣！我们欢迎各种形式的贡献。

## 如何贡献

### 报告问题

使用 GitHub Issues 报告 bug 或提出功能请求。请包括：
- 清晰的标题和描述
- 复现步骤（针对 bug）
- 预期行为 vs 实际行为
- 环境信息（操作系统、Node 版本等）
- 日志或截图（如果适用）

### 提交代码

1. Fork 仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 开发规范

- 遵循现有的代码风格（使用 Prettier 和 ESLint）
- 添加类型注解（TypeScript strict mode）
- 编写测试（目标覆盖率 >80%）
- 更新相关文档
- 确保所有测试通过 (`npm test`)

## 贡献类型

### Polyfills

我们特别欢迎 polyfills 贡献！

**什么是 Polyfill?**
Polyfill 是替代沙箱"魔法"行为的代码实现，使代码在真实环境中工作。

**如何贡献 Polyfill:**
1. 在 `src/transformers/polyfills/` 创建新文件
2. 实现类继承自 `BasePolyfill`
3. 添加单元测试
4. 在 `polyfills-registry.json` 中注册
5. 提交 PR 并描述：
   - 原始沙箱行为
   - 你的实现方式
   - 已知限制

### 沙箱适配器

添加对新沙箱平台的支持：

1. 在 `src/parsers/` 创建 `sandbox-name-analyzer.ts`
2. 实现平台特定的模式检测
3. 添加测试用例（真实代码示例）
4. 更新文档

### 文档

- 翻译现有文档到其他语言
- 添加使用案例和教程
- 改进 API 文档

### Bug 修复

查看标有 `good first issue` 的 Issues

## 代码审查流程

所有 PR 需要：
- 至少一位维护者批准
- 通过 CI 检查
- 解决所有请求的更改

## 行为准则

- 尊重所有贡献者
- 建设性反馈
- 欢迎新贡献者
- 聚焦于技术讨论

## 获得认可

- Contributors 页面列出所有贡献者
- 重要功能在发布说明中致谢
- 活跃贡献者可获得企业版免费许可

## 联系我们

- Discord: https://discord.gg/escapekit
- Email: community@escapekit.dev
```

### 9.2 社区治理

**维护者团队**:
- 项目创始人（拥有最终决定权）
- 核心贡献者（5-10 人，由社区投票选出）
- 领域专家（如特定语言的专家）

**决策流程**:
- 小更改：PR 直接合并（经 1 位维护者批准）
- 中等更改：在 Discord 讨论后决定
- 重大更改：RFC（Request for Comments）流程，社区投票

**发布周期**:
- 稳定版：每 6 周一次
- 补丁版本：按需发布
- Beta 版：每 2 周一次

---

## 10. 实现细节

### 10.1 代码分析实现

使用 Tree-sitter 进行静态分析和 npm registry API 验证：

```typescript
// src/analyzers/javascript-analyzer.ts
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';

export class JavaScriptAnalyzer {
  private parser: Parser;
  
  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(JavaScript);
  }
  
  async analyze(code: string): Promise<AnalysisResult> {
    const tree = this.parser.parse(code);
    
    const issues: Issue[] = [];
    
    // 检测 import 语句
    const importNodes = this.findAllNodes(tree.rootNode, 'import_statement');
    for (const node of importNodes) {
      const importName = this.extractImportName(node);
      const exists = await this.isValidNpmPackage(importName);
      if (!exists) {
        issues.push({
          type: 'ghost_import',
          importName,
          location: `line ${node.startPosition.row + 1}`
        });
      }
    }
    
    // 检测沙箱 API
    const apiCalls = this.findSandboxApis(tree);
    issues.push(...apiCalls);
    
    return new AnalysisResult(issues);
  }
  
  private async isValidNpmPackage(packageName: string): Promise<boolean> {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    return response.ok;
  }
}
```

### 10.2 依赖检查实现

```typescript
// src/registry/npm-registry.ts
import http from 'http';

export class NPMRegistry {
  private readonly BASE_URL = 'https://registry.npmjs.org';
  
  async packageExists(packageName: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.BASE_URL}/${packageName}`);
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
  
  async getLatestVersion(packageName: string): Promise<string> {
    const response = await fetch(`${this.BASE_URL}/${packageName}`);
    const data = await response.json();
    return data['dist-tags'].latest;
  }
}
```

### 10.3 项目生成实现

```typescript
// src/transformers/project-generator.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { renderTemplate } from '../utils/template-engine';

export class ProjectGenerator {
  constructor(private targetPlatform: string) {}
  
  async generate(
    analysisResult: AnalysisResult,
    outputDir: string
  ): Promise<GenerationResult> {
    // 创建目录结构
    await fs.mkdir(outputDir, { recursive: true });
    
    // 生成 package.json
    const packageJson = this.generatePackageJson(analysisResult);
    await fs.writeFile(
      path.join(outputDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // 生成转换后的代码
    const transformedCode = this.transformCode(analysisResult);
    await fs.writeFile(
      path.join(outputDir, 'src/index.ts'),
      transformedCode
    );
    
    // 生成 polyfills
    await this.generatePolyfills(analysisResult, outputDir);
    
    // 生成逃离契约
    await this.generateEscapeContract(analysisResult, outputDir);
    
    return {
      outputDir,
      filesCreated: ['package.json', 'src/index.ts'],
      escapeContractPath: path.join(outputDir, 'escape-contract.yaml')
    };
  }
}
```

### 10.4 逃离契约格式

```yaml
# escape-contract.yaml
version: "1.0"
kit_id: "ek-2026-03-14-abc123"
timestamp: "2026-03-14T10:00:00Z"

origin:
  sandbox: "google-ai-studio"
  code_hash: "sha256:..."
  language: "typescript"

target:
  runtime: "node"
  framework: "nextjs"

assumptions_detected:
  - id: "ass-001"
    type: "ghost_import"
    severity: "critical"
    description: "Import '@google/generative-ai' 未在 package.json 中声明"
    location: "app/api/chat/route.ts:1"
    resolution: "已添加到 package.json，版本 '^5.0.0'"
    auto_fixed: true

  - id: "ass-002"
    type: "mock_api"
    severity: "high"
    description: "检测到对 'https://mockapi.io/data' 的调用。这是模拟 API？"
    location: "lib/fetchData.ts:23"
    resolution: "替换为真实端点或保持条件性 mock。"
    auto_fixed: false
    suggestion: "使用环境变量在 mock 和生产之间切换。"

dependencies:
  installed:
    - name: "@google/generative-ai"
      version: "^5.0.0"
      purpose: "Google AI 的真实 API"
  ghost:
    - name: "@splinetool/viewer"
      why: "在 npm 中不存在"
      suggestion: "已替换为 '@splinetool/react-spline'"

validation:
  status: "pending"
  last_check: null
```

### 10.5 MCP 服务器实现

```typescript
// src/server.ts
import { PhotonSkill } from 'photon-skill';
import { analyzeCode } from './tools/analyze';
import { generateEscape } from './tools/generate';
import { validateReality } from './tools/validate';

const skill = new PhotonSkill('EscapeKit MCP');

skill.tool('analyze_sandbox_code', async (params) => {
  const { code, sandbox_type, target_runtime } = params;
  return await analyzeCode(code, sandbox_type, target_runtime);
});

skill.tool('generate_escape_kit', async (params) => {
  const { analysis_id, target_platform, output_dir } = params;
  return await generateEscape(analysis_id, target_platform, output_dir);
});

skill.tool('validate_reality', async (params) => {
  const { project_path, validation_level } = params;
  return await validateReality(project_path, validation_level);
});

skill.start();
```

---

## 11. 项目结构

```
RalphLoopInverso/
├── src/
│   ├── server.ts                 # MCP 服务器入口
│   ├── tools/                    # MCP 工具实现
│   │   ├── analyze.ts
│   │   ├── generate.ts
│   │   └── validate.ts
│   ├── analyzers/                # 代码分析器
│   │   ├── base.ts
│   │   ├── javascript-analyzer.ts
│   │   └── python-analyzer.ts
│   ├── transformers/             # 代码转换器
│   │   ├── base.ts
│   │   ├── polyfills/
│   │   │   ├── webgl-fallback.ts
│   │   │   └── map-api-wrapper.ts
│   │   └── project-generator.ts
│   ├── validators/               # 验证器
│   │   └── runtime-validator.ts
│   ├── registry/                 # 包注册表接口
│   │   ├── npm-registry.ts
│   │   └── pypi-registry.ts
│   ├── models/                   # 数据模型
│   │   └── schemas.ts
│   └── utils/                    # 工具函数
│       └── template-engine.ts
├── templates/                    # 代码模板
│   ├── nextjs/
│   ├── node/
│   └── python/
├── cli/                          # CLI 入口
│   └── index.ts
├── tests/
│   ├── test-analyzers.test.ts
│   ├── test-transformers.test.ts
│   └── test-validators.test.ts
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE                      # MIT License
```

---

## 12. 边界条件与异常处理

### 12.1 边界条件

1. **不支持的编程语言**: 
   - 初始支持 JavaScript/TypeScript 和 Python
   - 其他语言返回明确错误信息

2. **空代码输入**:
   - 返回清晰的错误提示
   - 建议用户提供有效的代码

3. **网络请求失败**:
   - 查询 npm/PyPI 时添加超时和重试机制
   - 提供离线模式（跳过依赖验证）

4. **超大文件**:
   - 设置文件大小限制（如 10MB）
   - 对大文件进行增量分析

### 12.2 异常处理策略

```typescript
// src/models/schemas.ts
export interface ErrorDetail {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface MCPResponse<T = any> {
  success: boolean;
  data?: T;
  errors: ErrorDetail[];
}

export function createErrorResponse(message: string, code = 'UNKNOWN_ERROR'): MCPResponse {
  return {
    success: false,
    errors: [{ code, message, severity: 'error' }]
  };
}

export interface AnalysisResult {
  analysisId: string;
  summary: {
    totalIssues: number;
    ghostImports: number;
    mockApis: number;
    unrealisticAssumptions: number;
  };
  issues: Issue[];
  confidenceScore: number;
}
```

---

## 13. 数据流动路径

### 13.1 分析流程

```
用户代码
    ↓
MCP Client (Claude/Cursor)
    ↓
EscapeKit MCP (analyze_sandbox_code)
    ↓
选择语言分析器
    ↓
Tree-sitter 解析 → 提取 AST
    ↓
模式匹配
    ├─ 检测幽灵 import → 查询 npm/PyPI API
    ├─ 检测沙箱 API → 对比已知 API 列表
    └─ 检测资源假设 → 分析代码模式
    ↓
收集问题
    ↓
生成分析报告
    ↓
返回 MCP Response
```

### 13.2 生成流程

```
分析结果
    ↓
MCP Client (generate_escape_kit)
    ↓
EscapeKit MCP (generate_escape_kit)
    ↓
应用代码转换
    ├─ 替换幽灵 import
    ├─ 注入 polyfills
    └─ 包装模拟 API
    ↓
生成项目结构
    ├─ 创建目录
    ├─ 生成配置文件
    ├─ 生成转换后的代码
    └─ 生成逃离契约
    ↓
返回生成结果
```

### 13.3 验证流程

```
生成的项目
    ↓
MCP Client (validate_reality)
    ↓
EscapeKit MCP (validate_reality)
    ↓
运行时验证
    ├─ 检查 WebGL 支持
    ├─ 测量 bundle 大小
    ├─ 测试 API 延迟
    └─ 验证 fallback 行为
    ↓
收集指标
    ↓
计算总体评分
    ↓
生成验证报告
    ↓
返回 MCP Response
```

---

## 14. 预期成果

### 14.1 功能成果

1. **MCP 服务器**: 一个完全可用的 MCP Server，可被 Claude Desktop、Cursor、Windsurf 等工具调用

2. **代码分析能力**:
   - 准确检测幽灵 import（准确率 > 90%）
   - 识别常见沙箱 API（支持 AI Studio、Bolt、Replit、CodeSandbox）
   - 检测资源假设（WebGL、无限带宽等）

3. **代码转换能力**:
   - 自动替换幽灵 import 为真实依赖
   - 生成常用 polyfills（WebGL fallback、API 包装器等）
   - 支持多平台项目生成（Next.js、Node、Deno、Python）

4. **验证能力**:
   - 真实环境运行时验证
   - 性能指标收集
   - 生产就绪度评估

### 14.2 质量成果

1. **代码质量**:
   - 测试覆盖率 > 80%
   - 类型注解完整（使用 TypeScript）
   - 遵循项目编码规范

2. **文档质量**:
   - 完整的 README
   - API 文档
   - 逃离契约示例
   - 使用案例文档

3. **用户体验**:
   - 清晰的错误提示
   - 详细的转换日志
   - 人类可读的逃离契约

### 14.3 可扩展性

1. **模块化设计**:
   - 分析器、转换器、验证器可独立扩展
   - 支持添加新的编程语言
   - 支持添加新的沙箱平台

2. **插件系统**:
   - 允许社区贡献自定义 polyfills
   - 支持自定义转换规则
   - 可配置的验证策略

### 14.4 社区与生态

1. **Open Source**: MIT License，鼓励社区贡献

2. **Marketplace**: 未来可建立 polyfill 市场

3. **企业版**: 提供企业级功能（监控、审计、CI/CD 集成）

---

## 15. 法律与合规

### 15.1 用户责任声明

**核心原则**: EscapeKit MCP 是代码转换工具，不生成、存储或分发用户代码。

**明确声明**（需在服务条款和 README 中）:

1. **代码所有权**:
   - 用户对其提供的原始代码拥有完全所有权
   - EscapeKit 生成的转换代码归用户所有
   - EscapeKit 不对转换后的代码主张任何版权

2. **沙箱 ToS 合规性**:
   - EscapeKit 仅转换用户从沙箱复制的代码
   - 用户负责确保其使用沙箱的行为符合沙箱服务条款
   - EscapeKit 不直接与沙箱 API 交互或绕过其限制

3. **生成的代码质量**:
   - EscapeKit 提供"尽力而为"的转换服务
   - 用户应审查生成的代码并负最终责任
   - 不保证生成的代码无 bug 或适用于生产环境

4. **数据隐私**:
   - 社区版：所有处理在本地完成，代码不发送到远程服务器
   - 云端版：仅在明确同意后才上传代码，且仅用于分析
   - 企业版：可部署在私有环境，数据不出组织网络

### 15.2 平台 ToS 风险评估

| 沙箱平台 | ToS 相关条款 | 风险等级 | 缓解措施 |
|----------|--------------|----------|----------|
| Google AI Studio | 代码导出受限 | 中 | 明确声明仅转换用户代码；不主张版权 |
| Bolt.new | 商业使用限制 | 低 | Bolt 已支持代码导出 |
| Replit | 代码归属用户 | 极低 | Replit 明确用户拥有代码 |
| CodeSandbox | 代码归用户 | 极低 | CodeSandbox 鼓励导出 |

**结论**: 法律风险较低，因为：
- 工具不主张生成代码的版权
- 用户对输入代码负责
- 转换过程是自动化和确定性的
- 不绕过沙箱的安全机制

### 15.3 知识产权策略

**开源代码**:
- MIT License - 最宽松，鼓励采用
- 第三方库：使用兼容的开源协议

**专有代码**（企业版）:
- 私有适配器和自定义 polyfills
- 按商业许可证授权

**商标**:
- "EscapeKit" 注册商标
- "Ralph Loop Inverso" 作为理论名称，不注册为商标

### 15.4 数据保护合规

**GDPR**（欧盟）:
- 处理 EU 用户数据需明确同意
- 提供数据导出和删除功能
- 指定 DPO（数据保护官）

**CCPA**（加州）:
- 尊重"不要出售我的信息"请求
- 透明的隐私政策

**SOC 2**（企业版）:
- Type II 认证（计划在 2027 年获得）
- 访问控制和审计日志

---

## 16. 市场分析与竞争优势

### 16.1 竞争对手分析

| 竞争对手 | 聚焦点 | 与 EscapeKit 的区别 |
|----------|--------|---------------------|
| TestSprite | AI 生成代码的自动化测试 | 聚焦验证，非转换和可移植性 |
| Parasoft SOAtest | 服务虚拟化 | 昂贵的复杂企业工具，不聚焦于 AI |
| 通用重构工具 | 代码重构 | 不理解 AI 沙箱的特定"魔法" |
| 无 | "沙箱逃离" | 没有人在此特定利基市场运营 |

### 16.2 竞争优势

- **先发优势**: 首个命名并解决"Ralph Loop Inverso"问题
- **AI 聚焦**: 理解 AI Studio 等平台的特性
- **MCP 集成**: 可直接从现代 IDE（Cursor、Windsurf）使用
- **开源（核心）**: 吸引社区并减少不信任感

### 16.3 市场考虑

- **欧盟法规**: Digital Markets Act 等法律强制互操作性和数据可移植性。AI 生成的代码是一种值得可移植性的"数据"
- **企业**: 大公司已在创建编排层以避免对单一供应商的依赖
- **中国**: "数字主权"运动和开源模型（如 DeepSeek）显示平台独立是全球性关切

---

## 17. 风险与缓解措施

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| **技术风险** | | | |
| 平台更改其代码生成模式 | 高 | 高 | 模块化解析器，基于 AST；通过社区快速更新机制；版本化的沙箱适配器 |
| 难以检测所有"魔法" | 中 | 中 | 从最常见的开始；允许用户报告新模式；confidence score 机制 |
| Tree-sitter 解析失败 | 低 | 中 | 降级到正则表达式匹配；提供手动报告选项 |
| **市场风险** | | | |
| 采用率低于预期 | 中 | 高 | Product-Led Growth 策略；与 AI 工具集成；免费版吸引试用 |
| 竞争对手以更多资源出现 | 低 | 高 | 先发优势；社区护城河；持续创新路线图 |
| 用户不认为这是问题 | 中 | 高 | 教育内容（Ralph Loop Inverso 理论）；案例研究展示痛点 |
| **法律风险** | | | |
| 违反平台 ToS | 低 | 中 | 明确用户责任；不主张代码版权；仅转换不存储 |
| 知识产权纠纷 | 极低 | 中 | MIT License；清晰的贡献者协议；法律审查 |
| 数据保护违规（GDPR/CCPA） | 低 | 中 | 隐私设计；数据最小化；企业版可私有部署 |
| **运营风险** | | | |
| 社区贡献不足 | 中 | 中 | 降低贡献门槛；Polyfill marketplace；贡献者激励 |
| 服务器成本失控 | 低 | 中 | 按使用定价；缓存策略；大部分处理在客户端 |
| 团队扩张导致质量下降 | 中 | 中 | 严格的代码审查；自动化测试；文化保持 |

---

## 18. MVP 范围定义

### 18.1 MVP 包含的功能

1. ✅ MCP 服务器基础框架
2. ✅ JavaScript/TypeScript 代码分析
3. ✅ 幽灵 import 检测
4. ✅ Next.js 项目生成
5. ✅ WebGL fallback polyfill
6. ✅ 基础验证功能

### 18.2 MVP 不包含的功能（未来迭代）

- ❌ Python 代码分析和转换
- ❌ 多沙箱平台支持（仅 AI Studio）
- ❌ 企业级功能
- ❌ Web Dashboard
- ❌ CI/CD 集成
- ❌ 高级验证策略
- ❌ 持续监控功能

---

## 19. 附录：示例使用场景

### 19.1 CLI 使用示例

```bash
# 分析来自文件的代码
escapekit analyze ./my-component.jsx --from ai-studio --to vercel-edge

# 生成逃离 kit
escapekit generate ek-2026-03-14-abc123 --include-docker --include-ci

# 本地验证
escapekit validate ek-2026-03-14-abc123 --env docker

# 监控生产（未来功能）
escapekit monitor https://mysite.vercel.app --kit-id ek-2026-03-14-abc123
```

### 19.2 典型用户场景

**场景**: João，自由开发者，使用 Google AI Studio 为客户网站生成了交互式 3D 组件。代码在 AI Studio preview 中完美运行。他复制粘贴到 Next.js 项目中...什么都没工作。导入错误、WebGL 未初始化、Google Maps API 返回 CORS 错误。

**使用 EscapeKit MCP**:

1. João 将代码粘贴到 Cursor 并调用工具：`@escapekit analyze`
2. 几秒后，MCP 返回报告："检测到 3 个幽灵导入（spline-viewer、google-maps-mock、infinite-loader）。WebGL 使用无回退。模拟的地图 API。"
3. João 执行：`@escapekit generate --id=abc123 --target=vercel`
4. MCP 生成包含以下内容的文件夹：
   - 修正后的代码（带 Three.js WebGL 回退、懒加载组件）
   - 带有真实依赖的 package.json
   - 地图 API 失败时的回退组件
   - 记录所有更改的逃离契约（YAML）
5. João 运行 `npm install && npm run dev`。网站在本地工作。
6. 30 分钟内，项目准备好部署，而不是几小时或几天的调试。

**价值**: 将挫败感转化为生产力。

---

## 20. 结论

EscapeKit MCP 是可行的，因为：

- 问题真实且增长（沙箱依赖）
- 解决它的技术成熟且可访问（MCP、parsers、registries）
- 市场已准备好（对 lock-in 的意识、对可移植性的需求）
- 开发可通过 AI 加速（MVP 几周内）
- 存在明确的商业模式（开源 + 服务）

它不仅是一个工具；它是对系统性新兴现象（您自己识别并命名的）的实用回应。"Ralph Loop Inverso"不必是宿命；EscapeKit 是打破它的关键。

现在是行动的时候。所有的棋子都在棋盘上；只需开始组装。