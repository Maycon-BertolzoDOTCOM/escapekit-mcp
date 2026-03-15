# EscapeKit MCP - 任务计划

## 任务概览

本任务计划基于 EscapeKit MCP PRD v2.1，分四个阶段实施：MVP、扩展、优化和社区、企业版。当前聚焦于 MVP（4-6 周）的实现。

---

## 阶段 0：战略性重构与测试增强（新增）

- [x] 任务 0.1：创建配置管理系统
    - 0.1.1: 创建 src/config.ts 配置文件
    - 0.1.2: 定义 NPMRegistryConfig 接口
    - 0.1.3: 定义 AnalyzerConfig 接口
    - 0.1.4: 实现配置验证函数
    - 0.1.5: 设置默认配置值

- [x] 任务 0.2：创建错误处理层次结构
    - 0.2.1: 创建 src/errors.ts 错误类文件
    - 0.2.2: 实现 EscapeKitError 基类
    - 0.2.3: 创建专用错误类（ParseError, NetworkError, NPMRegistryError, TimeoutError, ConfigurationError, ValidationError, AnalysisError）
    - 0.2.4: 实现错误类型守卫和工具函数
    - 0.2.5: 集成错误处理到现有代码

- [x] 任务 0.3：创建日志系统
    - 0.3.1: 创建 src/logger.ts 日志系统
    - 0.3.2: 定义 LogLevel 枚举（DEBUG, INFO, WARN, ERROR）
    - 0.3.3: 实现 Logger 类与不同日志级别
    - 0.3.4: 实现结构化日志输出
    - 0.3.5: 创建默认 logger 实例和工厂函数

- [x] 任务 0.4：重构 NPM Registry 服务
    - 0.4.1: 集成配置系统
    - 0.4.2: 集成错误处理层次结构
    - 0.4.3: 集成日志系统
    - 0.4.4: 实现重试逻辑（指数退避）
    - 0.4.5: 添加缓存统计功能

- [x] 任务 0.5：创建独立的检测器模块
    - 0.5.1: 创建 src/detectors/MockApiDetector.ts
    - 0.5.2: 创建 src/detectors/WebGLDetector.ts
    - 0.5.3: 创建 src/detectors/ImportDetector.ts
    - 0.5.4: 创建 src/detectors/SandboxDetector.ts
    - 0.5.5: 每个检测器实现独立测试接口

- [x] 任务 0.6：创建置信度计算器
    - 0.6.1: 创建 src/utils/ConfidenceCalculator.ts
    - 0.6.2: 实现基于问题类型和严重性的评分算法
    - 0.6.3: 实现置信度级别分类（critical, low, medium, high, excellent）
    - 0.6.4: 实现建议生成功能
    - 0.6.5: 集成到 CodeAnalyzer

- [ ] 任务 0.7：编写单元测试（目标覆盖率 >70%）
    - 0.7.1: MockApiDetector 单元测试
    - 0.7.2: WebGLDetector 单元测试
    - 0.7.3: ImportDetector 单元测试
    - 0.7.4: SandboxDetector 单元测试
    - 0.7.5: ConfidenceCalculator 单元测试
    - 0.7.6: NPMRegistry 单元测试（模拟网络故障）

- [ ] 任务 0.8：更新现有代码以使用新的模块
    - 0.8.1: 重构 JavaScriptAnalyzer 使用新的检测器
    - 0.8.2: 重构 CodeAnalyzer 使用新的置信度计算器
    - 0.8.3: 更新所有错误处理使用新的错误类
    - 0.8.4: 添加日志到所有关键操作
    - 0.8.5: 验证所有功能仍然工作

- [ ] 任务 0.9：集成测试
    - 0.9.1: 测试完整的分析流程
    - 0.9.2: 测试网络故障场景
    - 0.9.3: 测试缓存功能
    - 0.9.4: 测试重试逻辑
    - 0.9.5: 性能测试（1000 行代码 < 30 秒）

---

## 阶段 1：项目初始化与基础设施

- [x] 任务 1.1：初始化项目结构和配置
    - 1.1.1: 创建 TypeScript 项目，配置 tsconfig.json（strict mode）
    - 1.1.2: 设置 package.json，定义依赖（Photon Skill、Tree-sitter、Commander.js 等）
    - 1.1.3: 配置开发工具（ESLint、Prettier、Vitest）
    - 1.1.4: 创建基础目录结构（src、tests、templates、cli）
    - 1.1.5: 初始化 Git 仓库，配置 .gitignore

- [x] 任务 1.2：实现 MCP 服务器基础框架
    - 1.2.1: 使用 Photon Skill 创建 MCP 服务器入口（src/server.ts）
    - 1.2.2: 实现基础工具注册机制
    - 1.2.3: 添加错误处理和日志系统
    - 1.2.4: 编写服务器启动和健康检查的单元测试
    - 1.2.5: 验证 MCP 服务器可在 Claude Desktop 中连接

- [x] 任务 1.3：实现 CLI 基础框架
    - 1.3.1: 使用 Commander.js 创建 CLI 入口（cli/index.ts）
    - 1.3.2: 实现基础命令结构（analyze、generate、validate）
    - 1.3.3: 添加帮助信息和版本显示
    - 1.3.4: 实现命令参数解析和验证
    - 1.3.5: 编写 CLI 的集成测试

- [x] 任务 1.4：创建数据模型和类型定义
    - 1.4.1: 定义核心数据模型（AnalysisResult、Issue、EscapeKit、ValidationReport）
    - 1.4.2: 实现 MCP 响应格式（success、errors、data）
    - 1.4.3: 创建错误码枚举和错误详情接口
    - 1.4.4: 编写模型验证的单元测试
    - 1.4.5: 集成 Zod 或类似库进行运行时验证

---

## 阶段 2：代码分析引擎

- [x] 任务 2.1：实现 Tree-sitter 解析器基础
    - 2.1.1: 安装和配置 Tree-sitter JavaScript/TypeScript 语言包
    - 2.1.2: 创建 BaseParser 抽象类
    - 2.1.3: 实现 JavaScriptAnalyzer 类，支持代码解析为 AST
    - 2.1.4: 实现 AST 节点遍历和查询工具函数
    - 2.1.5: 编写解析器单元测试，验证正确解析常见代码模式

- [x] 任务 2.2：实现 npm Registry 查询接口
    - 2.2.1: 创建 NPMRegistry 类，封装 npm registry API
    - 2.2.2: 实现 packageExists() 方法，查询包是否存在
    - 2.2.3: 实现 getLatestVersion() 方法，获取包的最新版本
    - 2.2.4: 添加请求缓存和重试机制（超时、指数退避）
    - 2.2.5: 编写 Registry 接口的单元测试和集成测试

- [x] 任务 2.3：实现 Ghost Imports 检测器
    - 2.3.1: 从 AST 提取所有 import 语句（ES6、CommonJS）
    - 2.3.2: 识别包名和路径（相对/绝对）
    - 2.3.3: 查询 npm registry 验证包是否存在
    - 2.3.4: 过滤原生模块（Node.js 内置）
    - 2.3.5: 生成 Ghost Import 问题报告（位置、包名、建议替代品）

- [x] 任务 2.4：实现 AI Studio 沙箱模式检测
    - 2.4.1: 识别 AI Studio 特定的导入模式（@google/generative-ai 等）
    - 2.4.2: 检测模拟 API 调用（如 mockapi.io、localhost endpoints）
    - 2.4.3: 识别 WebGL 相关代码（three.js、canvas、WebGLRenderer）
    - 2.4.4: 实现沙箱类型自动识别逻辑
    - 2.4.5: 创建 AI Studio 特定的模式规则库

- [x] 任务 2.5：实现分析结果聚合和评分
    - 2.5.1: 收集所有检测到的问题（ghost imports、mock APIs、assumptions）
    - 2.5.2: 计算问题统计（总数、分类计数）
    - 2.5.3: 实现 confidence score 算法（基于检测置信度）
    - 2.5.4: 生成结构化的 AnalysisResult JSON
    - 2.5.5: 编写分析器的端到端测试

- [x] 任务 2.6：实现 analyze_code MCP 工具
    - 2.6.1: 创建 analyze.ts 工具模块
    - 2.6.2: 实现 analyze_sandbox_code MCP 工具函数
    - 2.6.3: 参数验证（code、sandbox_type、target_runtime）
    - 2.6.4: 调用 JavaScriptAnalyzer 执行分析
    - 2.6.5: 返回格式化的 MCP Response

- [x] 任务 2.7：实现 CLI analyze 命令
    - 2.7.1: 实现 escapekit analyze 命令
    - 2.7.2: 支持从文件路径或标准输入读取代码
    - 2.7.3: 添加 --from 和 --to 参数（沙箱来源和目标平台）
    - 2.7.4: 实现分析结果的可视化输出（表格、JSON）
    - 2.7.5: 生成 analysis_id 并保存到临时存储

---

## 阶段 3：代码转换引擎

- [ ] 任务 3.1：实现依赖解析器
    - 3.1.1: 创建 DependencyResolver 类
    - 3.1.2: 实现幽灵导入到真实包的映射规则库
    - 3.1.3: 查询 npm registry 获取真实包的最新版本
    - 3.1.4: 生成 package.json 的依赖列表
    - 3.1.5: 处理无法映射的导入（生成错误和建议）

- [ ] 任务 3.2：实现代码 AST 转换器
    - 3.2.1: 创建 BaseTransformer 抽象类
    - 3.2.2: 实现 ImportReplacer 转换器（替换幽灵导入）
    - 3.2.3: 使用 Babel 或 jscodeshift 操作 AST
    - 3.2.4: 保持代码格式和注释
    - 3.2.5: 生成转换后的代码字符串

- [ ] 任务 3.3：实现 WebGL Fallback Polyfill
    - 3.3.1: 创建 WebGLPolyfill 类
    - 3.3.2: 检测 WebGL 初始化代码
    - 3.3.3: 生成 Three.js fallback 代码
    - 3.3.4: 添加渐进式降级（WebGL → Canvas 2D → 静态图片）
    - 3.3.5: 编写 polyfill 的单元测试

- [ ] 任务 3.4：实现项目生成器
    - 3.4.1: 创建 ProjectGenerator 类
    - 3.4.2: 实现目录结构创建（src、public、config）
    - 3.4.3: 使用 Jinja2 或 Handlebars 生成 package.json
    - 3.4.4: 生成基础配置文件（tsconfig.json、next.config.js）
    - 3.4.5: 支持模板化代码生成（index.ts、App.tsx）

- [ ] 任务 3.5：实现逃离契约生成器
    - 3.5.1: 定义 EscapeContract 数据模型（YAML 结构）
    - 3.5.2: 实现契约内容生成（origin、transformations、assumptions）
    - 3.5.3: 记录所有应用的转换（ghost imports、polyfills）
    - 3.5.4: 添加验证状态和元数据
    - 3.5.5: 生成 escape-contract.yaml 文件

- [ ] 任务 3.6：实现 generate_escape MCP 工具
    - 3.6.1: 创建 generate.ts 工具模块
    - 3.6.2: 实现 generate_escape_kit MCP 工具函数
    - 3.6.3: 参数验证（analysis_id、target_platform、output_dir）
    - 3.6.4: 调用 DependencyResolver 和 Transformer
    - 3.6.5: 调用 ProjectGenerator 生成项目结构
    - 3.6.6: 返回生成的项目路径和文件列表

- [ ] 任务 3.7：实现 CLI generate 命令
    - 3.7.1: 实现 escapekit generate 命令
    - 3.7.2: 从临时存储加载分析结果（通过 analysis_id）
    - 3.7.3: 添加 --include-docker 和 --include-ci 选项
    - 3.7.4: 生成 Dockerfile 和 CI/CD 配置（GitHub Actions）
    - 3.7.5: 显示生成结果和下一步操作提示

---

## 阶段 4：验证引擎

- [ ] 任务 4.1：实现运行时验证器基础
    - 4.1.1: 创建 RuntimeValidator 类
    - 4.1.2: 实现项目构建验证（npm run build）
    - 4.1.3: 实现本地开发服务器启动验证（npm run dev）
    - 4.1.4: 添加超时和资源限制
    - 4.1.5: 实现验证状态跟踪和报告生成

- [ ] 任务 4.2：实现 Playwright E2E 测试
    - 4.2.1: 集成 Playwright 进行浏览器测试
    - 4.2.2: 实现页面加载验证（HTTP 200、无 JS 错误）
    - 4.2.3: 验证 WebGL 支持和 fallback 行为
    - 4.2.4: 截图和日志收集
    - 4.2.5: 生成性能指标（页面加载时间、bundle 大小）

- [ ] 任务 4.3：实现 Docker 容器验证
    - 4.3.1: 集成 Dockerode 进行容器管理
    - 4.3.2: 构建 Docker 镜像并启动容器
    - 4.3.3: 在容器内执行健康检查
    - 4.3.4: 清理容器和资源
    - 4.3.5: 记录容器日志和输出

- [ ] 任务 4.4：实现验证评分系统
    - 4.4.1: 定义验证指标（构建成功、运行成功、无错误）
    - 4.4.2: 实现 overall_score 计算算法（0-1）
    - 4.4.3: 生成详细的验证报告（metrics、issues、recommendations）
    - 4.4.4: 判断是否 ready_for_production
    - 4.4.5: 生成 validation-report.json

- [ ] 任务 4.5：实现 validate_reality MCP 工具
    - 4.5.1: 创建 validate.ts 工具模块
    - 4.5.2: 实现 validate_reality MCP 工具函数
    - 4.5.3: 参数验证（project_path、validation_level）
    - 4.5.4: 根据验证级别执行不同深度测试（basic/standard/thorough）
    - 4.5.5: 返回验证报告和评分

- [ ] 任务 4.6：实现 CLI validate 命令
    - 4.6.1: 实现 escapekit validate 命令
    - 4.6.2: 支持本地路径和 kit_id 两种输入方式
    - 4.6.3: 添加 --env 参数（docker/local）
    - 4.6.4: 实时显示验证进度
    - 4.6.5: 显示验证结果和修复建议

---

## 阶段 5：文档与测试完善

- [ ] 任务 5.1：编写核心文档
    - 5.1.1: 编写 README.md（项目介绍、快速开始、安装）
    - 5.1.2: 编写 API 文档（MCP 工具、CLI 命令）
    - 5.1.3: 编写架构文档（系统架构、数据流）
    - 5.1.4: 编写贡献指南（CONTRIBUTING.md）
    - 5.1.5: 编写许可证文件（MIT License）

- [ ] 任务 5.2：完善单元测试覆盖率
    - 5.2.1: 编写 Analyzers 模块的完整测试（目标覆盖率 >80%）
    - 5.2.2: 编写 Transformers 模块的完整测试
    - 5.2.3: 编写 Validators 模块的完整测试
    - 5.2.4: 编写 MCP 工具的集成测试
    - 5.2.5: 配置 CI/CD 自动运行测试（GitHub Actions）

- [ ] 任务 5.3：创建示例和教程
    - 5.3.1: 创建 AI Studio 代码示例（包含 ghost imports）
    - 5.3.2: 编写快速入门教程（5 分钟上手）
    - 5.3.3: 创建完整案例研究（从分析到部署）
    - 5.3.4: 录制视频教程（可选）
    - 5.3.5: 创建 FAQ 和故障排除指南

- [ ] 任务 5.4：性能优化和调试
    - 5.4.1: 分析性能瓶颈（profiling）
    - 5.4.2: 优化大文件解析（增量分析、流式处理）
    - 5.4.3: 添加调试模式和详细日志
    - 5.4.4: 实现缓存策略（npm 查询、解析结果）
    - 5.4.5: 优化内存使用（避免内存泄漏）

- [ ] 任务 5.5：实现错误处理和用户体验改进
    - 5.5.1: 统一错误消息格式和显示
    - 5.5.2: 添加友好的错误提示和解决建议
    - 5.5.3: 实现进度显示（加载条、spinner）
    - 5.5.4: 添加颜色输出和格式化显示
    - 5.5.5: 实现离线模式降级策略

---

## 阶段 6：MVP 验证与发布准备

- [ ] 任务 6.1：真实场景端到端测试
    - 6.1.1: 使用 3 个真实的 AI Studio 项目进行完整测试
    - 6.1.2: 验证分析→生成→验证的完整流程
    - 6.1.3: 测试成功部署到 Vercel
    - 6.1.4: 记录测试结果和问题
    - 6.1.5: 修复发现的关键 bug

- [ ] 任务 6.2：安全审计和依赖检查
    - 6.2.1: 运行 npm audit 检查安全漏洞
    - 6.2.2: 检查第三方依赖的许可证兼容性
    - 6.2.3: 审查代码中的敏感信息处理
    - 6.2.4: 验证数据不发送到外部服务器（社区版）
    - 6.2.5: 编写安全最佳实践文档

- [ ] 任务 6.3：准备发布工件
    - 6.3.1: 创建 npm package 配置（package.json 完善）
    - 6.3.2: 编写 CHANGELOG.md（v1.0.0）
    - 6.3.3: 创建发布标签和 GitHub Release
    - 6.3.4: 准备 npm 发布脚本
    - 6.3.5: 编写发布公告（博客、Twitter、Reddit）

- [ ] 任务 6.4：配置持续集成和部署
    - 6.4.1: 完善 GitHub Actions workflow（CI/CD）
    - 6.4.2: 配置自动化测试和代码质量检查
    - 6.4.3: 设置 npm 自动发布流程
    - 6.4.4: 配置文档站点部署（Vercel/Netlify）
    - 6.4.5: 设置监控和错误追踪（Sentry，可选）

- [ ] 任务 6.5：社区准备和支持
    - 6.5.1: 创建 GitHub Issues 和 Discussions 模板
    - 6.5.2: 设置 Discord 服务器（或 Slack）
    - 6.5.3: 准备常见问题解答（FAQ）
    - 6.5.4: 培训核心维护者（文档和流程）
    - 6.5.5: 准备首个版本发布活动

---

## 阶段 7：发布后迭代（阶段 2 预备）

- [ ] 任务 7.1：收集用户反馈和 metrics
    - 7.1.1: 集成匿名使用统计（opt-in）
    - 7.1.2: 监控 GitHub Issues 和 Discussions
    - 7.1.3: 分析用户行为数据（最常用功能、错误率）
    - 7.1.4: 收集 NPS（净推荐值）反馈
    - 7.1.5: 生成首月使用报告

- [ ] 任务 7.2：规划阶段 2 功能
    - 7.2.1: 评估 Bolt.new 和 Replit 集成需求
    - 7.2.2: 设计 Python 代码分析架构
    - 7.2.3: 规划 Mock APIs 检测器实现
    - 7.2.4: 评估高级 polyfills 需求（SwiftShader WASM）
    - 7.2.5: 制定阶段 2 里程碑和时间表

- [ ] 任务 7.3：学术对齐与供应链安全增强（基于中国学者关于代码幻觉的研究）
    - 7.3.1: 实现 Supply-Chain Attack Protection（检测 Ghost Dependencies 是否被恶意占位恶意注册）
    - 7.3.2: 扩展幻觉检测分类学（映射幻觉、命名幻觉、资源幻觉、逻辑幻觉，参考 Sun Yat-sen Univ 研究）
    - 7.3.3: 集成学术基准测试（如 HalluCode 和 CodeHaluEval）以量化分析引擎的准确率
    - 7.3.4: 实现基于 API 文档的动态提示/上下文注入（RAG）以辅助依赖恢复
    - 7.3.5: 发布关于 "Ralph Loop Inverso vs Package Hallucinations" 的学术白皮书

- [ ] 任务 7.4：开始阶段 2 开发准备
    - 7.4.1: 招募核心贡献者（社区）
    - 7.4.2: 设计插件系统架构
    - 7.4.3: 创建沙箱适配器开发者文档
    - 7.4.4: 规划 Polyfill Marketplace 技术方案
    - 7.4.5: 准备阶段 2 的 RFC（Request for Comments）

---

## 任务优先级说明

**最高优先级（P0）**: 重构与测试增强，确保代码质量
- 阶段 0 的所有任务

**高优先级（P0）**: 必须在 MVP 中完成的核心功能
- 阶段 1-4 的所有任务

**中优先级（P1）**: 提升 MVP 质量和用户体验
- 阶段 5 的任务 5.1-5.3

**低优先级（P2）**: 优化和发布准备
- 阶段 5 的任务 5.4-5.5
- 阶段 6 的所有任务

**未来迭代（P3）**: 阶段 2+ 的功能
- 阶段 7 的所有任务

---
</arg_value> |
> ]]>>
