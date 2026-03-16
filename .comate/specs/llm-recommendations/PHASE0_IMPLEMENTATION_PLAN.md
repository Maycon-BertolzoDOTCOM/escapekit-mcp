# 阶段 0 实施计划：最小可行推荐系统

**目标**: 在不延迟 Fase 3 的前提下，添加基础推荐能力  
**预计工作量**: 4-6 小时  
**截止日期**: 2025年3月17日（本周结束）  
**优先级**: 高（解决"诊断而无处方"的问题）

---

## 📋 概述

### 问题陈述

当前状态:
- ✅ EscapeKit 检测问题（ghost imports、框架混合、依赖项不匹配）
- ❌ 但不提供修复建议
- ❌ 用户必须手动研究如何修复

影响:
- 降低用户体验
- 增加修复时间
- 减少价值感知

### 解决方案

实现一个**最小可行推荐引擎**，提供:
1. 基于问题类型的通用最佳实践建议
2. 模板化的修复步骤
3. 可执行的命令
4. 相关文档链接

**不包含**:
- LLM 特定模式识别（阶段 1）
- 复杂架构决策支持
- 自动代码生成

---

## 🎯 实施任务

### 任务 1: 创建推荐模块（30 分钟）

**文件结构**:
```
src/recommendations/
├── index.ts                    # 主入口
├── RecommendationEngine.ts     # 推荐引擎
├── templates/                  # 推荐模板
│   ├── framework-mix.yaml
│   ├── ghost-import.yaml
│   ├── phantom-dependency.yaml
│   └── portability-issue.yaml
└── types.ts                    # 类型定义
```

**创建目录**:
```bash
mkdir -p src/recommendations/templates
```

---

### 任务 2: 实现推荐引擎（2 小时）

**文件**: `src/recommendations/RecommendationEngine.ts`

**功能**:
1. 根据问题类型加载推荐模板
2. 生成上下文感知的建议
3. 格式化为 Markdown 输出
4. 支持可执行的命令

**核心接口**:
```typescript
interface Recommendation {
  problemType: string;
  severity: 'error' | 'warning';
  description: string;
  steps: string[];
  commands?: string[];
  references?: string[];
}

interface RecommendationEngineOptions {
  problemType: string;
  context?: {
    framework?: string;
    platform?: string;
    dependencies?: string[];
  };
}
```

**主要方法**:
- `generate(problemType, context)`: 生成推荐
- `loadTemplate(problemType)`: 加载模板
- `formatAsMarkdown(recommendation)`: 格式化为 Markdown
- `getQuickFixCommands(recommendation)`: 获取快速修复命令

---

### 任务 3: 创建推荐模板（1.5 小时）

**文件**: `src/recommendations/templates/framework-mix.yaml`

```yaml
id: "framework-mix"
title: "Framework Mixing Detected"
description: "Your project uses multiple incompatible frameworks"
severity: "error"

summary: |
  Mixing frameworks like Next.js and Vite causes build failures,
  performance issues, and deployment problems.

detection_criteria:
  - "@sentry/nextjs" in package.json
  - "vite" in dependencies or devDependencies
  - "next/error" or "next/head" imports in code

recommended_actions:
  - id: "migrate-to-vite"
    title: "Migrate to Vite (Recommended for pure frontend)"
    steps:
      - "Remove Next.js dependencies: npm uninstall @sentry/nextjs"
      - "Install Vite-compatible alternatives: npm install @sentry/react"
      - "Remove Next.js specific imports from code"
      - "Delete next.config.ts if present"
      - "Update package.json scripts to use Vite"
      - "Run: npm run build to verify"
    
    commands:
      - "npm uninstall @sentry/nextjs @vercel/postgres"
      - "npm install @sentry/react"
      - "npm run build"
    
    references:
      - "https://vitejs.dev/guide/migration.html"
      - "https://docs.sentry.io/platforms/javascript/guides/react/"
  
  - id: "migrate-to-nextjs"
    title: "Migrate to Next.js (Recommended for SSR/backend)"
    steps:
      - "Remove Vite dependencies: npm uninstall vite @vitejs/plugin-react"
      - "Install Next.js: npm install next@latest"
      - "Create next.config.js"
      - "Move code to pages/ or app/ directory"
      - "Update package.json scripts for Next.js"
      - "Run: npm run dev to verify"
    
    commands:
      - "npm uninstall vite @vitejs/plugin-react"
      - "npm install next@latest"
      - "npm run dev"
    
    references:
      - "https://nextjs.org/docs/migration"
      - "https://docs.sentry.io/platforms/javascript/guides/nextjs/"

prevention:
  - "Choose one framework before starting the project"
  - "Use framework-specific package managers and generators"
  - "Run escapekit analyze during development to detect issues early"
```

**文件**: `src/recommendations/templates/ghost-import.yaml`

```yaml
id: "ghost-import"
title: "Ghost Import Detected"
description: "Your code imports a package that doesn't exist or has incorrect name"
severity: "error"

summary: |
  Ghost imports occur when AI-generated code uses incorrect package names
  that work in sandbox environments but fail in production.

detection_criteria:
  - Import statement with package name not found in npm registry
  - Package name matches known AI sandbox patterns

common_patterns:
  - original: "analytics-browser"
    correct: "@amplitude/analytics-browser"
    description: "Amplitude analytics package with correct scoped name"
  
  - original: "genai"
    correct: "@google/genai"
    description: "Google AI SDK with correct scoped name"
  
  - original: "react-awesome-charts"
    correct: "recharts" or "victory"
    description: "Alternative charting libraries with similar APIs"

recommended_actions:
  - id: "replace-ghost-import"
    title: "Replace Ghost Import with Correct Package"
    steps:
      - "Identify the correct package name from npm registry"
      - "Update import statements in affected files"
      - "Install the correct package: npm install <correct-package>"
      - "Update code to match correct API if needed"
      - "Run: escapekit validate to verify"
    
    commands:
      - "npm search <correct-package-name>"
      - "npm install <correct-package>"
      - "npm test"
    
    references:
      - "https://www.npmjs.com/"
      - "https://docs.npmjs.com/cli/search"

prevention:
  - "Run escapekit analyze during development"
  - "Check package names on npm registry before using"
  - "Use official SDK packages over generic wrappers"
```

**文件**: `src/recommendations/templates/phantom-dependency.yaml`

```yaml
id: "phantom-dependency"
title: "Phantom Dependency Detected"
description: "Your code uses a dependency that is not declared in package.json"
severity: "error"

summary: |
  Phantom dependencies are packages that are used in code but not
  listed in package.json, causing installation failures in production.

detection_criteria:
  - Import statement with package name not in dependencies or devDependencies
  - Package exists in npm registry

recommended_actions:
  - id: "add-missing-dependency"
    title: "Add Missing Dependency"
    steps:
      - "Install the missing package: npm install <package-name>"
      - "For devDependencies: npm install --save-dev <package-name>"
      - "Verify installation: npm list <package-name>"
      - "Run: escapekit validate to verify"
    
    commands:
      - "npm install <package-name>"
      - "npm install --save-dev <package-name>"
    
    references:
      - "https://docs.npmjs.com/cli/install"
      - "https://docs.npmjs.com/cli/list"

prevention:
  - "Run escapekit analyze during development"
  - "Use package.json auto-save features in IDE"
  - "Regularly audit dependencies: npm audit"
```

---

### 任务 4: 集成到 CLI（1 小时）

**文件**: `cli/index.ts`

**更新 `analyze` 命令**:
```typescript
import { RecommendationEngine } from '../src/recommendations/RecommendationEngine.js';

// ... existing code ...

.action(async (file, options) => {
  try {
    // ... existing analysis code ...
    
    // Generate recommendations
    const recommendationEngine = new RecommendationEngine();
    const recommendations = [];
    
    for (const issue of result.issues) {
      const recommendation = await recommendationEngine.generate(
        issue.type,
        {
          framework: result.detectedFramework,
          platform: options.to,
          dependencies: result.summary.dependencies
        }
      );
      recommendations.push(recommendation);
    }
    
    // Print recommendations
    if (recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      
      for (const rec of recommendations) {
        const icon = rec.severity === 'error' ? '🔴' : '🟡';
        console.log(`\n${icon} ${rec.title}`);
        console.log(rec.description);
        
        if (rec.commands && rec.commands.length > 0) {
          console.log('\n  ?? Quick Fix Commands:');
          rec.commands.forEach(cmd => {
            console.log(`     ${cmd}`);
          });
        }
        
        if (rec.references && rec.references.length > 0) {
          console.log('\n  📚 References:');
          rec.references.forEach(ref => {
            console.log(`     ${ref}`);
          });
        }
      }
    }
    
    // ... rest of the code ...
  }
});
```

**添加新选项**:
```typescript
.option('--recommend', 'Show recommendations for detected issues', true)
.option('--recommend-only', 'Show only recommendations, hide analysis')
```

---

### 任务 5: 测试（1 小时）

**测试用例**:

1. **框架混合测试**:
   ```bash
   npm run cli -- analyze tests/fixtures/framework-mix.ts --recommend
   ```

2. **Ghost import 测试**:
   ```bash
   npm run cli -- analyze tests/fixtures/ghost-import.ts --recommend
   ```

3. **Phantom dependency 测试**:
   ```bash
   npm run cli -- analyze tests/fixtures/phantom-dependency.ts --recommend
   ```

**验证**:
- [ ] 推荐正确生成
- [ ] Markdown 格式正确
- [ ] 命令可执行
- [ ] 引用有效
- [ ] 与现有 CLI 输出兼容

---

## 📊 成功标准

### 功能要求

- [x] 推荐引擎基于问题类型生成建议
- [x] 支持至少 3 种问题类型（框架混合、ghost import、phantom dependency）
- [x] 生成可执行的修复命令
- [x] 提供相关文档链接
- [x] 集成到 CLI 输出

### 用户体验要求

- [x] 推荐清晰易懂
- [x] 命令可以直接复制粘贴
- [x] 支持不同严重程度（error、warning）
- [x] 不延迟分析执行时间

### 技术要求

- [x] 模块化设计
- [x] 易于扩展（添加新模板）
- [x] 类型安全（TypeScript）
- [x] 测试覆盖

---

## 🚀 实施时间表

| 任务 | 预计时间 | 负责人 | 状态 |
|------|----------|--------|------|
| 任务 1: 创建模块 | 30 分钟 | Spec Agent | ⏳ 待开始 |
| 任务 2: 实现引擎 | 2 小时 | Spec Agent | ⏳ 待开始 |
| 任务 3: 创建模板 | 1.5 小时 | Spec Agent | ⏳ 待开始 |
| 任务 4: 集成 CLI | 1 小时 | Spec Agent | ⏳ 待开始 |
| 任务 5: 测试 | 1 小时 | Spec Agent | ⏳ 待开始 |
| **总计** | **6 小时** | - | - |

---

## 📝 后续步骤（阶段 1）

完成阶段 0 后，可以继续实施：

1. **LLM 特定模式识别**
   - 分析真实代码样本
   - 创建 LLM 特定规则
   - 实现分类器

2. **扩展模板库**
   - 添加更多问题类型
   - 改进现有模板
   - 支持多种场景

3. **机器学习增强**
   - 从使用中学习
   - 改进推荐准确性
   - 个性化建议

---

## 💡 关键决策

### 为什么选择 YAML 模板？

1. **易读易写**: 团队可以轻松编辑
2. **版本控制友好**: 易于 diff 和 merge
3. **可扩展**: 易于添加新字段
4. **与现有知识库一致**: 符合 `knowledge-base/` 结构

### 为什么不做 LLM 特定推荐？

1. **时间压力**: 需要 2-3 周，会延迟 Fase 3
2. **资源限制**: 需要分析代码样本，创建规则
3. **优先级**: CI/CD 和 Go-to-Market 更关键
4. **渐进方法**: 阶段 0 为阶段 1 奠定基础

---

## ✅ 验收标准

阶段 0 完成时，用户应该能够：

1. 运行 `escapekit analyze --recommend`
2. 看到针对检测到问题的清晰建议
3. 复制粘贴命令来修复问题
4. 查阅相关文档
5. 理解如何防止类似问题

**关键指标**:
- 推荐覆盖率: ≥ 80%（至少 3 种常见问题类型）
- 用户满意度: ≥ 4/5（未来调查）
- 修复时间减少: ≥ 50%（相比手动研究）

---

## 🎯 下一步行动

**立即执行**:
1. 审查此计划
2. 批准实施
3. 开始任务 1

**本周完成**:
- 实施所有 5 个任务
- 测试验证
- 更新文档

**下周开始**:
- 继续完成 Fase 3
- 开始 Railway 模板创建
- 准备阶段 1 规划

---

**准备开始实施？** 🚀