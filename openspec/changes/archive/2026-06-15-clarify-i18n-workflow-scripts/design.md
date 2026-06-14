## Context

i18n-studio 当前有三个面向词条同步的一等动作:从源码提取 key 的 `extract`、推送新增 key 的 `push`、从 studio 回灌文案的 `pull`。但 `packages/apps/i18n-studio/scripts/` 里同时存在:

- 可执行同步入口:`i18n-push.ts`、`i18n-pull.ts`
- 构建期派生工具:`i18n-codegen.ts`
- 纯函数 helper:`i18n-flatten.ts`、`i18n-sync-core.ts`

这种结构让目录本身传达出错误信号:helper 和 codegen 看起来像独立工作流步骤。实际语义应是:

```text
源码 key
  │
  ├─ extract
  │
  ├─ push ──> studio ── 翻译
  │
  └─ pull ──> locales/_meta.json + locales/<lang>/studio-ui.json
                └─ codegen ──> app/i18n/generated.ts
```

`codegen` 仍然是必要能力:它把磁盘 locale tree 转成静态 import、`SUPPORTED_LANGS`、`Lang` 类型和 `LOCALE_META`,供运行时 bundle 与 TypeScript 消费。但它不应作为词条工作流的一等步骤呈现。

## Goals / Non-Goals

**Goals:**

- 让 `scripts/` 只表达词条同步工作流入口,降低误读。
- 将 i18n 同步纯逻辑迁移到应用领域库目录,供脚本、seed 和单测复用。
- 将 codegen 明确为项目工具/构建期派生器,而非词条工作流步骤。
- 让 `i18n:pull` 成为完整的回灌命令:拉取资源后自动刷新 `generated.ts`。
- 保持 `build` / `typecheck` 的离线 codegen 前置能力。

**Non-Goals:**

- 不改变 studio 的 snapshot/import API。
- 不改变 `app/i18n/locales/` 文件格式或 `app/i18n/generated.ts` 导出形状。
- 不改变运行时浏览器拉取最新文案的行为。
- 不引入新的包、构建系统或数据库迁移。

## Decisions

### 1. `scripts/` 只保留工作流入口

目标结构:

```text
packages/apps/i18n-studio/
  scripts/
    i18n-push.ts
    i18n-pull.ts

  tools/
    i18n-codegen.ts

  app/lib/i18n-sync/
    resources.ts
    workflow.ts
```

选择 `scripts/` 只放 `push/pull`,是因为它是开发者最容易扫到的“可执行入口清单”。`extract` 仍由 `i18next-cli` 直接提供,无需本地 wrapper 文件。`codegen` 移到 `tools/`,表示它是项目本地工具,不是业务同步入口。

备选方案是把 codegen 留在 `scripts/` 并只改文档。这个方案改动更小,但目录仍会持续传达“四个流程”的错觉。

### 2. 纯 helper 放在 `app/lib/i18n-sync/`

`flatten/unflatten` 与 `diffNewEntries/fillPlaceholders` 不是泛化工具函数,它们定义的是 studio flat key model 与本地 i18next resource model 的转换/同步规则。因此不放入 `app/utils` 或 `app/helpers` 这类泛目录,而放进有领域名的 `app/lib/i18n-sync/`。

备选方案是 `app/helpers`。这个名字更短,但语义太宽,后续容易变成杂项目录。

### 3. `pull` 自动串联 codegen

`i18n:pull` 应在资源拉取全部成功后执行 codegen,使一个命令完成“回灌到可构建状态”。如果拉取中有失败项,pull 仍应以非零退出,不运行 codegen,避免基于半成品资源刷新 `generated.ts`。

`i18n:codegen` 保留为低层命令,供 build/typecheck、CI、调试和手动修复使用。

### 4. 文档只暴露三步工作流

文档中的主流程应写成 `extract -> push -> pull`。图中可以标注 `pull` 内部会刷新 `generated.ts`,但不要求用户手动执行第四步。

## Risks / Trade-offs

- 路径迁移漏改 import -> 通过 `rg` 检查旧路径,并运行 typecheck/test 覆盖脚本与单测。
- `i18n:pull` 自动 codegen 使 pull 写入文件更多 -> 在日志中明确输出 pull 与 codegen 两段结果;失败时保持非零退出。
- `tools/` 是新目录 -> 通过 package.json 和 docs 固化其用途,仅承载项目级构建/维护工具。
- `app/lib/i18n-sync` 位于 app 下,但被 Node 脚本引用 -> helper 必须保持纯函数、无 React/DOM/服务端副作用,避免引入运行时边界问题。

## Migration Plan

1. 新建 `app/lib/i18n-sync/`,迁移 helper 文件并更新 push/pull/seed/tests import。
2. 新建 `tools/`,迁移 `i18n-codegen.ts`,更新 `package.json` 中 `i18n:codegen`、`build`、`typecheck`、`i18n:pull` 命令。
3. 调整 `i18n-pull.ts` 注释和完成日志,移除“请再运行 codegen”的提示。
4. 更新 `app/docs/guide.md` 的流程图和命令示例。
5. 用 `rg` 确认无旧 helper/codegen 路径残留。
6. 运行 `pnpm -F i18n-studio i18n:codegen`、`typecheck`、相关 i18n 单测;如环境允许,再跑完整 test/build。

## Open Questions

- `i18n:pull` 是否通过 package.json 串联 `tsx scripts/i18n-pull.ts && pnpm i18n:codegen`,还是由 `i18n-pull.ts` 内部调用 codegen 函数/子进程? 倾向 package.json 串联,保持 pull 脚本只负责网络回灌,codegen 工具保持独立。
