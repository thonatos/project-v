## Context

当前项目是一个 pnpm monorepo，使用 biome.js 作为代码 lint 和格式化工具。biome.json 配置了：
- VCS 集成（git）
- TypeScript/JavaScript 文件检查（packages/**/*.ts, packages/**/*.tsx, packages/**/*.js）
- 格式化规则：2 空格缩进、120 字符行宽、单引号、分号
- CSS/Tailwind 支持
- UI 组件目录的 lint 禁用 override

Oxlint 是 Oxide 项目推出的 lint 工具，基于 Rust 编写，性能优于 biome 50-100 倍。oxfmt 是配套的格式化工具（目前仍在开发中）。

**现状约束：**
- oxfmt 目前仍在积极开发中，功能可能不如 biome formatter 完善
- oxlint 支持大部分 ESLint 规则，但不是 100% 兼容
- 项目使用 Tailwind CSS，需要确保 CSS 格式化兼容

## Goals / Non-Goals

**Goals:**
- 用 oxlint 替代 biome lint，保持 lint 功能完整性
- 用 oxfmt 替代 biome format，保持格式化一致性
- 更新所有相关 npm scripts
- 更新 CI/CD workflow 以使用新工具
- 保持现有 lint/format 行为一致性（尽可能）

**Non-Goals:**
- 不改变 lint 规则的具体内容（只切换工具）
- 不引入新的 lint 规则
- 不优化 CI 性能（这是迁移的副作用收益）

## Decisions

### Decision 1: 工具选择 - oxlint + oxfmt

**选择理由：**
- oxlint 基于 Rust，性能远超 biome（50-100 倍）
- oxlint 与 ESLint 规则高度兼容，迁移成本低
- Oxide 团队活跃维护，社区支持良好

**备选方案：**
- ESLint + Prettier：传统方案，但性能较慢
- 保持 biome：稳定可靠，但性能提升空间有限

### Decision 2: oxlint 配置迁移策略

**选择：** 创建新的 oxlint.json 配置文件，映射现有 biome 规则

**理由：**
- oxlint 配置格式与 ESLint 类似，迁移直观
- 保留 biome.json 作为备份参考

### Decision 3: oxfmt 状态处理

**选择：** 等待 oxfmt 稳定后再迁移格式化，或使用 biome format 作为过渡

**理由：**
- oxfmt 目前仍在开发中（alpha 状态）
- 可以先迁移 lint，后迁移 format

**过渡方案：**
```
阶段 1: oxlint lint + biome format
阶段 2: oxlint lint + oxfmt format（当 oxfmt 稳定后）
```

### Decision 4: 安装方式

**选择：** 使用 npm 包安装 oxlint

**理由：**
- 与项目现有依赖管理方式一致
- pnpm 可以良好支持

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| oxfmt 功能不完善 | 先用 oxlint lint，保留 biome format |
| oxlint 规则覆盖不全 | 检查规则兼容性，必要时添加忽略规则 |
| CI 配置遗漏 | 逐步更新，并在每个步骤测试 |
| 格式化结果不一致 | 迁移前备份，迁移后对比差异 |

## Migration Plan

### 阶段 1: 准备

1. 检查 oxlint 安装方式和配置选项
2. 分析现有 biome 规则，确认 oxlint 兼容性
3. 创建 oxlint.json 配置文件

### 阶段 2: oxlint 迁移

1. 安装 oxlint npm 包
2. 创建 oxlint.json 配置
3. 更新 package.json lint scripts
4. 运行 oxlint，修复或忽略不兼容规则
5. 更新 CI workflow

### 阶段 3: oxfmt 迁移（可选，视 oxfmt 稳定性）

1. 安装 oxfmt（如果可用）
2. 配置格式化规则
3. 更新 package.json format scripts
4. 格式化全项目代码
5. 移除 biome 依赖

### 回滚策略

- 保留 biome.json 和 @biomejs/biome 依赖（阶段 2）
- 在 package.json 中注释保留原 biome scripts
- 如遇问题，恢复原 scripts 即可回滚

## Open Questions

1. oxfmt 是否已达到可用状态？需要检查最新发布版本
2. oxlint 是否支持 Tailwind CSS 相关的 lint 规则？
3. 是否需要保留 biome 的 CSS 格式化功能？