## Context

dsh-telegram 当前的模型来源是单一的：`runtime.js#createSession`（551 行）与 `#sessionFor` 的 resume 分支（459 行）各自调用 `ctx.agentDefaultModel.currentSelection()`，把快照作为 `agentOptions` 传给 `ctx.agents.create/resume`。这是上一次重构（`2026-08-25-refactor-telegram-plugin`）刻意确立的：它取代了插件内手写的 `installModelSelection` 复刻，把「provider/model 不漂移」交给 dsh 官方的 `agentOptions` 机制。`agent/integration.js:77` 留有明确注释记录该决定。

这个设计的代价是模型不可变。`agentOptions` 是 Agent 创建瞬间的快照，之后无论全局默认怎么改，存活 Session 都不受影响。Owner 想换模型只能去 Web UI 改全局默认，再 `/new`。

本变更要求「切了当前会话立刻生效，且 `/new` 之后仍是它」，这两半分别落在不同机制上：立刻生效只有 Agent 级可变选择能做到，跨会话继承只有插件自己的持久化能做到。

约束：
- 插件的 dsh 依赖面刻意极瘦（仅 `dsh-storage-domain` + `schemastery`），任何新依赖都要论证
- 目标 dsh 版本 `0.1.5-rc.1` 是 rc，API 有变动风险
- `telegram_bindings` domain 已有线上数据，schema 变更必须可读旧记录
- Telegram 单条消息 4096 字符上限；现有 `#sendCard` 不分片，`#sendText` 分片

## Goals / Non-Goals

**Goals:**

- `/model` 列出所有 provider 及模型，每行可直接复制为命令参数
- `/model <provider> <model>` 切换：当前 Session 下一个 step 生效，历史保留，不新建 Session
- 选择持久化在私聊绑定上，跨 `/new`、跨 Workspace 切换、跨 resume 重建、跨 Runtime 重启存活
- 不污染 dsh 全局默认设置，不影响 Web UI 与其他 Session
- 修复三处绑定整对象覆盖写，使「绑定新增字段」这件事从此安全

**Non-Goals:**

- `reasoningEffort` 选择（`ModelSelection` 的第三个字段）——留待后续 `/effort`
- inline 按钮选择模型——已评估并放弃，理由见决策 4
- provider 省略推断（`/model <model>`）——参数必须两个，零歧义优先
- 群聊或多 Owner 的模型选择——Runtime 仍限制在单 Owner 私聊
- 复刻或改进 dsh 的模型目录/路由逻辑——只消费官方接口

## Decisions

### 决策 1：重新引入 `installModelSelection`，来源改为官方导出

**选择**：`import { installModelSelection } from '@deepseek-ai/dsh-agent'`，在 `buildAgentSetup` 与 `#ensureBridges` 两条路径上安装 Agent 级 `ModelSelectionRef`。

这直接反转了 `agent/integration.js:77` 记录的上一次决定，必须说清区别：上次删掉的是**插件手写的复刻**，理由是复刻会与官方实现漂移；当时也没有热切换需求，`agentOptions` 足够。本次引入的是**官方导出的正品**，且需求已变。反转的是「用不用这个机制」，不是「该不该手写复刻」——后者的结论仍然成立且被遵守。

官方语义（`dsh-agent/model-selection.d.ts`）恰好匹配需求：
- prompt assembly 前快照 `current`，所以并发切换落在后续 step，不会撕裂当前请求
- provider/model 变化时自动向下次请求追加一条 durable user-role 通知——模型自己知道换过

**代价**：新增 `@deepseek-ai/dsh-agent` 依赖，版本须与 dsh core 对齐（`0.1.5-rc.1`）。

**替代方案**：
- 只用 `agentOptions` + 切换后自动新建 Session。零新依赖，但丢失对话历史，不满足需求
- 再次手写复刻。零新依赖但明确违背上次重构结论，且要自行追踪官方语义变化
- 走 `ctx.agentDefaultModel.saveSelection()`。一行 API，但污染全局、影响 Web UI，且对存活 Session 无效——两个要求都不满足

### 决策 2：`agentOptions` 与 `ModelSelectionRef` 双写同源

两个机制并存，必须同源否则会打架。规则：**同一个 selection 值同时喂给两处**。

```
resolveSelection(chatId):
    binding.provider && binding.model  →  用它
    否则                                →  agentDefaultModel.currentSelection()
         │
         ├─→ agentOptions（create/resume 的初始快照）
         └─→ ModelSelectionRef.current（后续 step 的可变来源）
```

`/model` 切换时只改 `ref.current` + 持久化绑定；不回头改 `agentOptions`（它已是历史快照，改不了也不该改）。下次 create/resume 时 `resolveSelection` 自然读到新的绑定值，两处重新对齐。

### 决策 3：三处绑定写入改为字段保留

这是本变更里**最容易漏且最难发现**的一点。`runtime.js` 470、484、501 三处均为：

```js
await this.#bindings.set(chatId, { sessionId, workspaceId });
```

整对象覆盖。若只在 `/model` 处写入 provider/model，则任意一次 Workspace 切换（501）或 resume 失败重建（470/484）都会静默抹掉模型选择，回落全局默认且无任何提示。

修复方式是在写入处读取现有绑定并展开保留。更强的保障是把「保留既有字段」下沉到 `persist.js` 的 `set()`（改为 merge 语义），使未来新增字段自动安全。倾向后者：这类 bug 的根因是「调用方必须记得带全所有字段」这个易错契约，消除契约比修三个调用点更彻底。实施时需确认 merge 语义不会与「删除字段」的需求冲突（当前无此需求）。

### 决策 4：清单走按行分片的 HTML，不走 card 也不走纯文本

`#sendCard` 不分片，且卡片是 HTML `<blockquote>` 包裹——从中间切开会劈断标签，Telegram 直接报错。模型清单长度不可预测（聚合类 provider 可报上百个模型），必须分片。

初版选了纯文本 `#sendText`（分片是现成的），结果实测很丑：provider 在每行重复且毫无视觉层级。真机看过之后改为**按行分片的 HTML**：`modelListChunks` 以行为最小单位累积分片，因此每个 `<code>` 必然完整落在同一片内，标签永不断裂——这既避开了 `#sendText` 按字符切会劈断标签的问题，也不需要给 card 加分片能力。

每行渲染成 `<code>/model &lt;provider&gt; &lt;model&gt;</code>`。选 `<code>` 而非纯文本的关键原因：Telegram 的 code 实体**点一下整段复制**，且复制出来的正好是可直接发送的完整命令，比「复制两个词再手工拼 `/model`」少两步。provider 因此在每行重复，那是「一行即一条可用命令」的必要代价。provider 标题加粗分组、当前项打 ✓ 补上了视觉层级。

代价是清单外观仍与 `/status`、`/workspace` 的 blockquote 面板不同。接受：清单是「可操作的命令列表」，不是「状态面板」，两者形态本就该有差别。所有动态值（provider 名、model id、失败原因）都经 `escapeHtml`，否则畸形 id 会破坏标签结构——已有测试锁定。

inline 按钮方案在探索阶段被放弃，理由记录在此以免重复讨论：callback_data 有 64 字节硬限制，`dsh:model:select:` 前缀占 17 字节，长 model id 会超限；而 `cards.js:133` 现有策略是**静默丢弃**超限按钮，表现为「卡片上列着该模型但按钮不存在」且无报错。绕开需引入服务端临时索引表（存哪、活多久、重启失效如何提示）。手动输入把这一整类问题连根消除。

### 决策 5：校验用 `resolveModelInfo`，不用目录白名单

dsh 在 `dsh-llm` 中反复声明「catalog membership is advisory and never changes routing or request validation」。据此，「不在 `listModels` 结果里」不能作为拒绝理由——目录可能不全，或模型刚上线。

用 `ctx.llm.resolveModelInfo(provider, model)` 问具体路由是否存在。手动输入模式下这反而是优势：清单只是给人抄的参考，不是白名单。

### 决策 6：不 bump domain version，只加 optional 字段

新增两个 optional 字段，`version` 保持 1。加字段不是不兼容变更：旧记录缺字段仍通过校验（optional），旧代码读新记录时 zod 会剥离多余键。两个方向都兼容，无需版本号介入。

**这条决策在实施阶段被真机推翻过一次，记录以免重犯。** 原方案是「bump 到 2 + `compatibleVersions: [1]`」，理由是 `.d.ts` 上写着 compatibleVersions 用于「当前 schema 也接受的旧版本记录」。全部单测通过，但既有部署一启动就失败：

```
StorageError: unit 'telegram_bindings': stored version 1 != expected 2
  code: 'version-mismatch'
```

根因是 `compatibleVersions` **只对 `per-record` layout 生效**。本 domain 用默认的 `single` layout（整个 unit 一个 JSON 文档），其 `parse()` 无条件比对版本戳。dsh-storage-json 的源码注释说得很直白：

> an unaccepted version stamp discards the record instead of migrating it (**the whole-unit format rejects instead**, because there is exactly one document)

教训有两层。一是 `compatibleVersions` 的适用范围写在 per-record 的上下文里，读 `.d.ts` 时被误当成通用行为；二是**内存 mock 当时不校验版本戳**，于是这个必然的启动失败在单测里完全隐形。mock 已补上版本戳检查，并新增一条「用已落盘版本戳打开」的测试；把改动退回 bump 方案会让 3 个测试失败。

version 只应在存储格式真正不兼容时才动，且必须同时提供迁移路径。

### 决策 7：命令清单收敛为单一来源并按长度排序

命令清单原先在三处各有一份硬编码副本：`client.js` 的 `TELEGRAM_COMMANDS`（Telegram 菜单）、`#runCommand` 的 `/help` 分支、以及同函数的 `unsupported` 分支。加 `/model` 时三处都要改——这类"必须记得同步 N 处"的契约正是本变更在绑定字段上已经消除过一次的问题，没理由在命令清单上保留。

现在 `client.js` 的 `COMMAND_DEFINITIONS` 是唯一来源，导出 `TELEGRAM_COMMANDS`（带描述，供菜单）与 `TELEGRAM_COMMAND_NAMES`（`/new` 形式，供两处提示）。

排序按命令名长度升序，同长度保持定义顺序（`Array.prototype.sort` 自 ES2019 起保证稳定）。结果是 `/new /stop /help /model /status /workspace`——短命令在前更易扫读，最长的 `/workspace` 自然落在末尾。排序在导出处一次完成，三处呈现因此天然一致，无需各自维护顺序。

测试锁定的是不变量而非快照：断言长度序列本身已排序、末位是 `/workspace`、`TELEGRAM_COMMAND_NAMES` 与 `TELEGRAM_COMMANDS` 顺序一致、`/help` 的 `<code>` 正文逐行等于 `TELEGRAM_COMMAND_NAMES`。去掉排序或改成降序都会让 2 个测试失败。

## 流程图

**`/model <provider> <model>` 切换**

```
Owner                Runtime              ctx.llm        Agent(ref)      bindings
  │                     │                    │              │              │
  ├─ /model p m ───────▶│                    │              │              │
  │                     ├─ 参数数量==2? ──┐   │              │              │
  │                     │◀─ 否 ───────────┘   │              │              │
  │◀─ 用法提示 ─────────┤ (状态不变)          │              │              │
  │                     │                    │              │              │
  │                     ├─ resolveModelInfo ▶│              │              │
  │                     │◀─ 抛错 ─────────────┤              │              │
  │◀─ 不可用(脱敏) ─────┤ (状态不变)          │              │              │
  │                     │                    │              │              │
  │                     │◀─ ok ───────────────┤              │              │
  │                     ├─ ref.current = {p,m} ─────────────▶│              │
  │                     │                    │       (下一 step 生效,       │
  │                     │                    │        当前 turn 不中断)     │
  │                     ├─ set(chatId, {...旧字段, p, m}) ──────────────────▶│
  │◀─ card: 已切换 ─────┤                    │              │              │
```

**下一次创建/恢复 Session 时的选择来源**

```
#sessionFor / #createSession
        │
        ├─ binding = bindings.get(chatId)
        │
        ├─ binding.provider && binding.model ?
        │       │                    │
        │      是                   否
        │       │                    │
        │       ▼                    ▼
        │  用绑定的选择      agentDefaultModel.currentSelection()
        │       │                    │
        │       └────────┬───────────┘
        │                ▼
        │        selection（单一来源）
        │                │
        │       ┌────────┴────────┐
        │       ▼                 ▼
        │  agentOptions      setup 里
        │  （初始快照）   installModelSelection(ref)
        │                   ref.current = selection
        ▼
   Agent 就绪：初始快照与可变 ref 对齐
```

**复用已存活 Agent 的补装路径**

`#sessionFor` 有一条「从 `ctx.agents.get()` 拿裸 Agent 复用」的分支（445-453 行），该路径 **setup 不会执行**。现有代码已为此设置 `#ensureBridges` + `#bridged` 去重来补装桥接。模型选择 ref 必须走同一补装机制，否则复用路径上的 Session 拿不到 ref，`/model` 对它无效——这是与既有 bug 完全同形的陷阱。

## Risks / Trade-offs

- **`@deepseek-ai/dsh-agent` 是 rc 版本，`installModelSelection` 签名可能变** → 依赖锁精确版本（不用 `^`），与 dsh core 版本对齐；在 README 记录版本耦合关系，与现有 `0.3.1 targets dsh 0.1.5-rc.1` 的记法一致

- **依赖面扩大后，后续 dsh 升级的适配成本上升** → 接受。只从该包导入 `installModelSelection` 单一符号，把耦合面压到最小；不导入其他类型或工具

- **三处覆盖写若漏改一处，症状是「模型选择偶尔莫名重置」——难复现、难归因** → 优先在 `persist.js` 层做 merge（消除契约而非修调用点）；同时补测试覆盖「切 Workspace 后模型仍在」和「resume 失败重建后模型仍在」两条路径

- **复用已存活 Agent 路径漏装 ref，症状是「某些会话 /model 没反应」** → 复用 `#bridged` 同一去重集合，使 ref 安装与桥接安装同生共死；补测试断言复用路径上 ref 已安装

- **`listModels` 对聚合类 provider 可能返回上百条，清单刷屏** → 本版接受。分片保证不出错，可读性问题留给后续（可选 `/model <provider>` 只列单个 provider，但那会引入「一个参数」的歧义，需单独设计）

- **`resolveModelInfo` 是异步且可能慢或超时** → 切换命令本身在 `#processMessage` 的串行队列内，慢会阻塞该聊天后续普通消息但不影响 `/stop`（fast-path 在 `#handleMessage` 拦截）。需确认是否要加超时；倾向不加，先观察

- **持久化的模型在部署变更后失效（provider 被摘掉）** → spec 已要求回落全局默认 + 一次明确提示，禁止静默降级。这是唯一会主动打扰用户的路径，但静默漂移更糟

- **切换时机与 durable 通知的交互**：官方会在 provider/model 变化时向下次请求追加 user-role 通知。若 Owner 连续切换多次而中间无请求，通知行为由官方逻辑决定（比较 assembled 与最新 request header），插件不应自行去重 → 不干预，交给官方

## Migration Plan

部署：
1. 加依赖并锁版本，`pnpm -F @implementsio/dsh-telegram build`
2. 绑定 schema 加两个 optional 字段，`version` 不动；在有旧数据的 profile 上验证 `open` 成功
3. 三处覆盖写修复 + 测试先行（这两条测试在功能实现前应先失败）
4. 命令与清单
5. 热切换 + ref 补装路径

回滚见 proposal 的 Rollback Plan。分三层，每层独立可用：摘命令 → 摘热切换 → 完整 revert。因 `version` 未变，任何一层回滚都不会触发版本戳拒绝，旧 schema 读到新字段时按 zod 默认剥离，最坏情况仅丢失模型选择。

## Open Questions

实施阶段已解决：

- **`persist.js` 的 `set()` 改 merge 后无法表达「删除字段」** → 接受。整条绑定的移除仍走 `delete`；当前没有「只删某个字段」的需求。已补测试锁定 `delete` 后重建不会复活旧选择。
- **旧代码读含新字段的记录会拒绝还是剥离** → 剥离。zod object 默认丢弃未声明的键，因此完整回滚是安全的，最坏情况仅丢失模型选择。已补测试固定该结论。
- **`/status` 是否区分选择来源** → 不区分。卡片只显示实际生效的 `<provider> <model>`；来源区分留给 `/model` 的清单顶部。
- **清单显示绑定值还是实际生效值** → 实际生效值。两者在持久化选择失效并回落后不一致，显示生效值才不会误导。
- **`resolveModelInfo` 是否加超时** → 不加。先观察真实延迟；该调用在聊天串行队列内，慢会阻塞后续普通消息但不影响 `/stop`（fast-path 在 `#handleMessage` 拦截）。

实施阶段新发现并已修复：

- **`#sessionFor` 的第三条 delete-then-rebuild 分支**：resume 成功但 cwd 不属于当前 Workspace 时，会 `dispose` + `delete` 绑定再落到重建路径。原计划只考虑了「Workspace 失效」与「resume 抛错」两条，漏了这条。因为它先 delete，persist 的 merge 救不了它（已无记录可 merge），必须显式带回选择。三条分支现统一走 `#rebuildSession`，`carried` 在函数入口一次性取出。已补测试覆盖。
- **`#switchWorkspace` 的绑定写入不需要显式带回**：该路径不 delete，merge 已足够。原计划的显式带回是冗余的，变异测试证实移除后无任何测试失败，故删去以免误导后来者。
- **domain version 不该 bump**（详见决策 6）：真机启动失败暴露了 `compatibleVersions` 只对 per-record layout 生效。已改回 version 1，并给内存 mock 补上版本戳检查——原 mock 不查版本，是这个必然失败在单测里隐形的直接原因。

## Verification Notes

自动化：90 个测试全绿（新增 20 个），`pnpm lint` 0 error，格式与构建通过。

关键修复用变异检验确认有效性（改坏源码后必须失败）：

| 变异 | 被捕获 |
|---|---|
| `persist.set` 退回整对象覆盖 | 3 个测试失败 |
| `#rebuildSession` 不带 `carried` | 2 个测试失败（resume 抛错 / cwd 不匹配） |
| `#resolveSelection` 忽略绑定 | 2 个测试失败 |
| `#ensureBridges` 漏装模型选择 | 1 个测试失败 |
| domain bump 到 version 2 + compatibleVersions | 3 个测试失败 |
| 清单渲染去掉 `escapeHtml` | 1 个测试失败 |
| 命令清单去掉排序 / 改成降序 | 各 2 个测试失败 |

最后一项是补上 mock 的版本戳检查之后才有效的——原 mock 不校验版本，因此真实的启动失败在单测里完全隐形。这是本次唯一一个「单测全绿但上线即挂」的缺陷，也说明 mock 与真实 backend 的行为差距本身就是风险面。

`#ensureBridges` 那项起初也无法捕获：`/status` 会回落到绑定值，掩盖了选择缺失。改为断言切换回复文案（「当前会话下一轮生效」对「将在新会话生效」）后才有效——那是热切换是否真的装上的唯一用户可见信号，因为绑定无论如何都会写。

端到端：用真实 `JsonStorageBackend` + `descriptorOf(bindingsDomain)` 打开线上数据文件（`~/.dsh/storages/telegram_bindings.json` 的副本），确认 open 成功、既有记录可读、写入模型选择后正确落盘且版本戳仍为 1。

未自动化（需真实 Telegram 私聊）：tasks 8.6、8.7。
