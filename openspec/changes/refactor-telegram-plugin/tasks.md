## 1. 准备与基线

- [x] 1.1 运行 `node --test test/*.test.js` 与 `pnpm lint` 记录重构前基线（全绿）
- [x] 1.2 添加依赖 `@deepseek-ai/dsh-storage-domain`（含 `zod`）到 `package.json` 并 `pnpm install`

## 2. 拆分：transport 与 inbound（无行为变更）

- [x] 2.1 新建 `src/transport/client.js`（迁移 `createTelegramClient` + 事件归一化）
- [x] 2.2 新建 `src/transport/transport.js`（迁移 `createTelegramTransport`）
- [x] 2.3 新建 `src/transport/inbound.js`（迁移 `normalizeInboundMessage` + `splitMessageText`）
- [x] 2.4 更新 `runtime.js` 及测试的 import 路径；删除 `telegram-client.js`
- [x] 2.5 运行 `node --test` + `pnpm lint` 全绿

## 3. 拆分：render 层 + 正文切 HTML

- [x] 3.1 新建 `src/render/renderer.js`（从 `message.js` 迁移 `StreamRenderer`）
- [x] 3.2 新建 `src/render/cards.js`（迁移原 `outbound.js`，`escapeHtml` 收敛到 render/html.js）
- [x] 3.3 新建 `src/render/html.js`：实现 `markdownToHtml`（受限标签）+ `escapeHtml`
- [x] 3.4 新建 `src/render/stream.js`（迁移 `StreamSession`），`#sendRich/#editRich` 改用 `parse_mode: 'HTML'` + `markdownToHtml`，保留纯文本降级
- [x] 3.5 删除 `markdown.js`；`markdown.test.js` 改写为 `test/html.test.js`（转换 + 转义 + 降级用例）
- [x] 3.6 更新 `stream.test.js` 断言为 HTML 路径；删除 `outbound.js`、`message.js` 中已迁移内容
- [x] 3.7 运行 `node --test` + `pnpm lint` 全绿

## 4. 会话持久化切换到 storage 子系统

- [x] 4.1 新建 `src/persist.js`：`defineDomain('telegram-bindings', ...)` + 封装 open/get/entries/put/delete/close
- [x] 4.2 `index.js` / `runtime.js` 的 `inject` 增加 `storageDomain`；`start()` open domain、`stop()` close domain
- [x] 4.3 将 `runtime.js` 中 `#bindings.get/set/delete` 调用点改为 domain 调用（语义保持）
- [x] 4.4 删除 `session-store.js`、`defaultStatePath()`、`homedir` import 及"绝不落 cwd"相关注释与 `$DSH_HOME` 推导
- [x] 4.5 新建 `test/persist.test.js`（mock storageDomain：增删查 + 重启恢复绑定）
- [x] 4.6 更新 `runtime.test.js` 移除文件路径相关断言；运行 `node --test` + `pnpm lint` 全绿

## 5. 拆分：agent 集成层 + 入口正规化

- [x] 5.1 新建 `src/agent/lifecycle.js`（迁移 `sessionFor`/`createSession`/resume/`stopAgentTurn`）
- [x] 5.2 新建 `src/agent/integration.js`（迁移 `buildAgentSetup` + interaction-bridge + session-stream）
- [x] 5.3 `preset.mount` 改用 `ctx.agentPresets.mount(agentCtx, id?)`；`inject` 增加 `agentPresets`，去掉 `ctx.get()` 兜底
- [x] 5.4 运行 `node --test` + `pnpm lint` 全绿

## 6. model-selection 复刻的去留（测试驱动）

- [x] 6.1 新增契约测试：断言 `agents.create` 与 `agents.resume` 收到的 `agentOptions` 恒等于 `currentSelection()` 快照
- [x] 6.2 resume 侧补传 `agentOptions`；删除 `installModelSelection` 调用（`buildAgentSetup` 不再管 selection）
- [x] 6.3 真机验证：重启 dsh，实测无 DSML 文本泄漏（agentOptions 快照生效，正文纯净）
- [x] 6.4 依据 6.1 契约测试通过 + agentOptions 两侧一致：删除 `src/agent/model-selection.js`
- [x] 6.5 运行 `node --test` + `pnpm lint` 全绿

## 7. runtime 收尾与死代码清理

- [x] 7.1 删除 `#runCommand` 中不可达的 `stop` 分支
- [x] 7.2 精简 `runtime.js` 至仅编排职责（handleMessage 路由 / processMessage / reaction / 媒体交付 / userFacingError）
- [x] 7.3 确认 `clearWorkspace`/`remove`/`textFromContent` 等死代码已随迁移删除
- [x] 7.4 全量 `node --test` + `pnpm lint` 全绿

## 8. 验证与交付

- [x] 8.1 对照现有 spec 场景逐条回归（命令、路由、interaction、媒体、reaction、错误分类）
- [x] 8.2 真机手测：文本富文本渲染 ✓、流式编辑增长 ✓、超长分片 ✓、图片入站识别 ✓、/new /status /help + blockquote 卡片 ✓、👀 reaction ✓、并发事件序列化修复 ✓。图片出站：agent 写 markdown 本地路径而非登记 attachment，Telegram HTML 不支持内联图 → 降级为文本（agent 行为，非管线缺陷，用户确认跳过）。interaction 审批：dsh core 从不发射 `interaction/*` 事件（不在 KNOWN_SESSION_EVENT_TYPES），真实审批走 `approval/request` answerer 链，HEAD 与重构后均未注册 answerer → 行为一致零回归，真机不可触发，逻辑由单测覆盖
- [x] 8.3 `openspec validate refactor-telegram-plugin --json` 通过
- [x] 8.4 分批 conventional commits 提交（走 git hooks，不跳过）
