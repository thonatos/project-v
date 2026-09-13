## 1. 前置修复：绑定字段保留

先做这一层。它独立于 `/model`，修的是既有缺陷，且后续所有持久化都依赖它正确。

- [x] 1.1 在 `test/persist.test.js` 增加失败测试：对同一 chatId 先写入含额外字段的绑定，再只写 `{ sessionId, workspaceId }`，断言额外字段仍存在
- [x] 1.2 在 `test/runtime.test.js` 增加失败测试：绑定含模型选择时切换 Workspace（走 `#switchWorkspace`），断言新绑定仍保留该选择
- [x] 1.3 在 `test/runtime.test.js` 增加失败测试：绑定含模型选择且 resume 抛错触发重建，断言重建后的绑定仍保留该选择
- [x] 1.4 将 `persist.js` 的 `set()` 改为 merge 语义（读取现有记录后展开合并），使调用方无需带全所有字段
- [x] 1.5 复核 `runtime.js` 470、484、501 三处写入在 merge 语义下行为正确；若 merge 不足以覆盖，补充显式字段保留
- [x] 1.6 确认 1.1–1.3 全部转绿，`pnpm -F @implementsio/dsh-telegram test` 通过

## 2. 依赖与持久化 schema

- [x] 2.1 `package.json` 增加 `@deepseek-ai/dsh-agent`，锁精确版本以对齐 dsh core `0.1.5-rc.1`（不使用 `^`）
- [x] 2.2 `src/index.js` 的 `inject` 数组增加 `llm`
- [x] 2.3 `persist.js` 的 `BindingValue` 增加 `provider` 与 `model` 两个 optional 字段
- [x] 2.4 `bindingsDomain` 的 `version` 保持 1（加 optional 字段不是不兼容变更；`single` layout 下 bump 会让既有部署启动失败）
- [x] 2.5 增加测试：预置无模型字段的旧记录后 `open` 成功、可读且新字段为 undefined；内存 mock 补上版本戳检查，使 bump version 这类改动在单测即暴露
- [x] 2.6 在有旧数据的 profile 上验证启动不报版本或记录错误（真机复现了 bump version 导致的 `version-mismatch`，已改回 version 1 并用真实 backend 打开线上数据文件验证通过）
- [x] 2.7 验证回滚可行性：旧 zod schema 读含新字段的记录确认被剥离而非拒绝；并用真实 JSON backend 打开线上数据文件端到端验证 open 与写入

## 3. 选择解析与双写同源

- [x] 3.1 新增选择解析逻辑：绑定含 `provider`+`model` 时用它，否则回落 `ctx.agentDefaultModel.currentSelection()`
- [x] 3.2 `#createSession` 与 `#sessionFor` 的 resume 分支改用该解析结果替代直接调用 `currentSelection()`
- [x] 3.3 修改 `test/runtime.test.js:546` 的既有契约测试：断言目标从「`agentOptions` 恒等于 `currentSelection()` 快照」改为「恒等于解析后的选择」，并保留「无绑定选择时回落全局默认」这一半
- [x] 3.4 增加测试：绑定含模型选择时，create 与 resume 两侧的 `agentOptions` 均等于绑定值而非全局默认
- [x] 3.5 增加测试：`/model` 切换后调用 `/new`，断言新 Session 的 `agentOptions` 等于切换后的选择
- [x] 3.6 增加测试：切换后不得调用 `agentDefaultModel.saveSelection`（断言全局设置未被污染）

## 4. 命令解析

- [x] 4.1 `parseCommand` 正则增加 `model` 分支，并将返回值结构从 `{ name }` 扩展为可携带参数
- [x] 4.2 保持 `/workspace` 带参数仍返回 `unsupported` 的既有行为不变
- [x] 4.3 `/model` 参数按空白切分：零个参数为列表形态，恰好两个为切换形态，其余数量返回用法提示
- [x] 4.4 `client.js` 的 `TELEGRAM_COMMANDS` 增加 `/model` 及中文描述
- [x] 4.5 `#runCommand` 的 `unsupported` 与 `help` 两处提示文本更新为六个命令
- [x] 4.6 `cards.js` 的 `controlCard` 标签表增加 `model` 条目
- [x] 4.7 增加 `parseCommand` 单元测试：覆盖零参数、两参数、一参数、三参数、`/model@botname` 形式

## 5. 模型清单

- [x] 5.1 实现清单构建：`ctx.llm.listProviders()` 后逐个 `listModels(provider)`，单个 provider 失败就地标注不可用并继续
- [x] 5.2 每个模型渲染为独立一行 `<provider> <model>`，确保可直接复制为命令参数
- [x] 5.3 清单顶部标注当前实际生效的选择（而非绑定值——两者在回落后会不一致）
- [x] 5.4 清单通过 `#sendText` 交付（走现有分片路径），不走 `#sendCard`
- [x] 5.5 无任何可路由 provider 时返回明确提示，不得返回空消息
- [x] 5.6 增加测试：mock 多 provider，断言输出按行分组且格式可复制
- [x] 5.7 增加测试：某 provider 的 `listModels` 抛错时，其余 provider 仍正常列出且该 provider 被标注
- [x] 5.8 增加测试：清单超过 `messageLimit` 时被分片为多条消息

## 6. 模型切换与热生效

- [x] 6.1 `#bridgeArgs` / `installAgentBridges` / `buildAgentSetup` 接入 `installModelSelection`，并持有该 Agent 的 `ModelSelectionRef`
- [x] 6.2 更新 `agent/integration.js:77` 的注释：说明重新引入的是官方导出而非手写复刻，以及上次重构结论的哪一半仍然成立
- [x] 6.3 `#ensureBridges` 补装路径同样安装 ref，复用 `#bridged` 去重集合
- [x] 6.4 实现切换：`resolveModelInfo` 校验通过后，同时改 `ref.current` 与持久化绑定；校验失败保持原状态
- [x] 6.5 校验失败的错误信息经脱敏处理，接入 `userFacingError`
- [x] 6.6 增加测试：切换后 ref 的 `current` 已更新，且未创建新 Session、未 dispose 原 Agent
- [x] 6.7 增加测试：`resolveModelInfo` 抛错时绑定与 ref 均不变
- [x] 6.8 增加测试：模型不在 `listModels` 结果中但 `resolveModelInfo` 通过时，切换被接受
- [x] 6.9 增加测试：复用已存活 Agent 的路径（`ctx.agents.get` 分支）上 ref 已安装，`/model` 生效
- [x] 6.10 增加测试：Agent 处于 running 状态时切换被接受且未触发 cancel

## 7. 失效选择与状态展示

- [x] 7.1 创建或恢复 Session 时，若绑定的选择已不可路由，回落全局默认并向 Owner 发送一次明确提示
- [x] 7.2 增加测试：绑定选择失效时回落成功、提示被发送、Session 正常建立
- [x] 7.3 `statusCard` 增加当前模型字段；决定是否标注来源（design.md Open Questions 之一）
- [x] 7.4 更新 `test/core.test.js` 或相应快照测试以覆盖 `statusCard` 新字段

## 8. 收尾

- [x] 8.1 `README.md` 命令清单增加 `/model` 两种形态，并说明选择的持久化范围与继承语义
- [x] 8.2 `README.md` 记录新增的 `@deepseek-ai/dsh-agent` 版本耦合关系，沿用现有版本记法
- [x] 8.2a 插件版本 `0.3.1` → `0.4.0`（新增面向用户的功能与一个新依赖，属 minor），同步 `README.md` 的版本记法
- [x] 8.2b 重建 `lib/client.js`：版本号在构建时内联并显示在 Settings UI，不重建会显示旧版本；构建后需 `oxfmt` 使 diff 收敛为单行
- [x] 8.3 `pnpm -F @implementsio/dsh-telegram test` 全绿
- [x] 8.4 `pnpm lint` 通过
- [x] 8.5 `pnpm -F @implementsio/dsh-telegram build` 通过
- [x] 8.6 真实 Telegram 私聊手动验证：`/model` 列表可读、复制粘贴切换成功、当前会话立刻生效且历史保留、`/new` 后仍是新模型、切 Workspace 后仍是新模型、重启 Runtime 后仍是新模型
- [x] 8.7 手动验证输错模型名的提示可读且不泄露内部细节
