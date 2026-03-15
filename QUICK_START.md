# EscapeKit - 快速开始指南

## 📦 安装

```bash
# 从 GitHub 克隆项目
git clone https://github.com/escapekit/escapekit-mcp.git
cd escapekit-mcp

# 安装依赖
npm install

# 构建项目
npm run build
```

## 🚀 基础使用

### 1. 分析代码

```bash
# 分析本地文件
npx tsx cli/index.ts analyze path/to/your/code.js

# 分析代码字符串
npx tsx cli/index.ts analyze --code "import { mockApi } from 'mockapi.io';"

# 指定源沙箱类型
npx tsx cli/index.ts analyze code.js --from ai-studio

# 输出 JSON 格式
npx tsx cli/index.ts analyze code.js --json > analysis.json
```

### 2. 生成可移植项目（开发中）

```bash
# 基于分析结果生成项目
npx tsx cli/index.ts generate analysis-1234567890-abc123

# 指定目标平台
npx tsx cli/index.ts generate analysis-id --target nextjs

# 指定输出目录
npx tsx cli/index.ts generate analysis-id --output ./my-app

# 包含 Docker 支持
npx tsx cli/index.ts generate analysis-id --include-docker

# 包含 CI/CD 配置
npx tsx cli/index.ts generate analysis-id --include-ci
```

### 3. 验证代码（开发中）

```bash
# 本地验证
npx tsx cli/index.ts validate ./my-app --env local

# Docker 环境验证
npx tsx cli/index.ts validate ./my-app --env docker

# 深度验证
npx tsx cli/index.ts validate ./my-app --level thorough
```

## 📝 示例代码

### 示例 1: 检测 Ghost Import

```javascript
// ai-generated-code.js
import { useState } from 'react';
import * as THREE from 'three.js';  // ❌ 包名错误
import { api } from 'mockapi.io';    // ❌ 不存在的包

export function App() {
  // ...
}
```

**分析输出**:
```
❌ [GHOST_IMPORT] Package "mockapi.io" does not exist on npm
❌ [GHOST_IMPORT] Package "three.js" should be "three"
```

### 示例 2: 检测 Mock API

```javascript
// 使用 mock API
fetch('https://mockapi.io/users')
  .then(res => res.json())
  .then(data => console.log(data));
```

**分析输出**:
```
⚠️ [MOCK_API] Mock API detected: mockapi.io
💡 Replace with real API endpoints
```

### 示例 3: 检测 WebGL 使用

```javascript
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';

export function Scene() {
  return (
    <Canvas>
      <mesh />
    </Canvas>
  );
}
```

**分析输出**:
```
⚠️ [UNREALISTIC_ASSUMPTION] WebGL usage detected: three
💡 Add WebGL support detection and fallback
```

## 🔍 分析结果解读

### 分析摘要

```
Summary:
   Total Issues: 3              # 总问题数
   Ghost Imports: 1             # 幽灵导入数
   Mock APIs: 1                 # 模拟 API 数
   Unrealistic Assumptions: 1   # 不切实际假设数
   Security Risks: 0            # 安全风险数
   Confidence Score: 0.40        # 置信度分数 (0-1)
```

### 问题类型

| 类型 | 严重性 | 说明 |
|------|--------|------|
| GHOST_IMPORT | ❌ Error | 不存在的 npm 包 |
| MOCK_API | ⚠️ Warning | 模拟 API 调用 |
| UNREALISTIC_ASSUMPTION | ⚠️ Warning | 不切实际的假设 |
| SECURITY_RISK | ❌ Error | 安全风险 |

### 置信度分数

- **0.0-0.3**: 需要大量修改
- **0.4-0.6**: 需要中等修改
- **0.7-0.9**: 需要少量修改
- **1.0**: 无需修改

## ??️ 开发命令

```bash
# 运行测试
npm test

# 运行测试并监视更改
npm test -- --watch

# 代码检查
npm run lint

# 代码格式化
npm run format

# 构建 TypeScript
npm run build

# 启动开发服务器（MCP）
npm run dev
```

## 📊 项目结构

```
RalphLoopInverso/
├── cli/                 # CLI 入口
│   └── index.ts        # 主程序
├── src/
│   ├── analyzers/      # 分析器
│   ├── models/         # 数据模型
│   ├── services/       # 服务层
│   ├── server.ts       # MCP 服务器
│   └── tools/          # MCP 工具
└── tests/              # 测试文件
```

## 🔌 MCP 集成

### 在 Claude Desktop 中使用

1. 创建 Claude Desktop 配置文件：
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. 添加 EscapeKit MCP 服务器：

```json
{
  "mcpServers": {
    "escapekit": {
      "command": "node",
      "args": ["/path/to/escapekit-mcp/dist/server.js"]
    }
  }
}
```

3. 重启 Claude Desktop

4. 在 Claude 中使用：
   - "Analyze this code for sandbox dependencies"
   - "Generate an escape kit for this analysis"
   - "Validate this code in a real environment"

## 🐛 故障排除

### 问题：`ts-node` 错误

```bash
# 解决方案：使用 tsx 代替 ts-node
npm install -g tsx
npx tsx cli/index.ts analyze code.js
```

### 问题：NPM 查询失败

```bash
# 检查网络连接
ping registry.npmjs.org

# 检查防火墙设置
# 确保可以访问 https://registry.npmjs.org
```

### 问题：TypeScript 编译错误

```bash
# 清理并重新安装
rm -rf node_modules
rm -rf dist
npm install
npm run build
```

## 📚 更多资源

- [完整文档](README.md)
- [PRD 文档](.comate/specs/escapekit_mcp/doc.md)
- [任务计划](.comate/specs/escapekit_mcp/tasks.md)
- [项目状态](.comate/specs/escapekit_mcp/PROJECT_STATUS.md)

## 💡 提示

1. **分析代码前**：确保代码文件格式正确
2. **生成项目前**：先运行分析并查看结果
3. **验证代码前**：确保项目构建成功
4. **使用 --json**：方便脚本集成和自动化
5. **检查 Confidence Score**：低分数表示需要大量修改

## ?? 获取帮助

```bash
# 查看帮助信息
npx tsx cli/index.ts --help

# 查看具体命令帮助
npx tsx cli/index.ts analyze --help
npx tsx cli/index.ts generate --help
npx tsx cli/index.ts validate --help
```

---

**需要帮助？**
- GitHub Issues: https://github.com/escapekit/escapekit-mcp/issues
- Discord: https://discord.gg/escapekit
- Email: support@escapekit.dev