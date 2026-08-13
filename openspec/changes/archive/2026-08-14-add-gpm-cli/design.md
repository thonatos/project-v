## Context

我们要在现有 pnpm monorepo 中新增一个名为 `gpm` 的 Git 项目管理 CLI。gpm 是开发者本地工具，不是可部署应用或共享库，因此新增 `packages/tools` 工具分层，并将其放在 `packages/tools/gpm`。

gpm 的主要职责是读取用户级 JSON 配置、把多种 Git 远程地址映射为稳定的绝对目录、调用系统 Git，并提供既适合交互使用又适合 shell 捕获的输出。用户已确定配置保持 `{"root":["/absolute/path"]}` 数组形式，但只能包含一个绝对 root。构建技术采用实验性的 `scriptc`，开发时使用 TypeScript，发布时生成不依赖 Node.js 的原生二进制。

## Goals / Non-Goals

**Goals:**

- 在 `packages/tools/gpm` 提供边界清晰、可测试的四命令 CLI。
- 安全解析配置和 Git 地址，生成 `<root>/<host>/<repository-path>` 绝对目录。
- 不经 shell 调用系统 Git，并保留认证交互、实时输出与失败状态。
- 将诊断与机器可读结果分流，使 clone 结果可被 shell 稳定捕获。
- 保持源码处于 scriptc 静态编译能力范围，不引入动态 JavaScript 引擎。
- 将工具包纳入现有 pnpm workspace、lint 和 format 流程。

**Non-Goals:**

- 不提供 pull、update、list、remove、批量 clone 或仓库索引。
- 不支持 `owner/repository` 隐式 GitHub 简写或本地文件仓库。
- 不管理 Git 凭据、SSH key 或 credential helper。
- 不覆盖已有 `.gpmrc`，不覆盖、删除或自动更新已有目标目录。
- 不构建 WASI 产物；WASI Preview 1 无法启动系统 Git。
- 首版不提供自定义配置位置、命令行 root 覆盖或多个 root 的选择策略。

## Decisions

### 1. 工具位于 packages/tools/gpm

新增 `packages/tools/*` workspace pattern，并将 package 放在 `packages/tools/gpm`。这明确区分开发工具、应用和共享库，也允许使用 `pnpm -F gpm ...` 独立构建和测试。

备选方案是 `packages/apps/gpm`，但 gpm 不运行服务也不部署为应用；另一备选方案是 `go/cmd/gpm`，但用户已选择 scriptc 的 TypeScript 原生编译路线。

### 2. 使用 TypeScript 和 scriptc 静态原生构建

package 固定 `scriptc` 的精确版本，构建前运行 `scriptc coverage`，构建命令不使用 `--dynamic`。实现优先使用 scriptc 支持的 `node:fs`、`node:os`、`node:path`、`node:child_process` 和必要的终端输入 API，不引入 CLI、配置或颜色 npm 依赖。

这能生成不依赖 Node.js 的单一原生二进制，并避免嵌入 QuickJS 带来的体积和行为差异。`scriptc` 仍处于实验阶段，因此 Node 侧行为测试与原生二进制 smoke test 都作为发布门槛。

### 3. 使用单一入口和可测试的纯函数边界

首版保持小型结构，以 `src/main.ts` 为原生入口；地址解析、配置校验、目标路径计算和命令分派保持为无副作用或显式依赖的函数。只有文件读写、TTY 询问和 Git 子进程位于 I/O 边界。若 scriptc 对测试导入或静态编译提出限制，再按职责拆分文件，而不预先引入框架层。

命令参数访问前必须检查 `process.argv.length`，因为 scriptc 对数组越界读取会直接终止进程。`JSON.parse` 的结果按 `unknown` 逐层校验，不依赖不安全断言。

### 4. 配置只接受一个绝对 root

配置路径固定为当前用户 home 下的 `.gpmrc`。配置结构保留数组形式，但 `root` 必须是长度为 1 的非空字符串数组，且唯一元素必须通过平台绝对路径检查。运行时不展开 `~`，从而避免 shell、用户数据库和执行环境差异。

`gpm init` 使用系统 home 计算 `<home>/gpm`，再将已展开的绝对值写入单行 JSON。配置已存在时不覆盖；root 已存在时保留内容。clone 在交互式终端可确认后复用 init 逻辑，非交互环境直接要求先执行 `gpm init`，避免脚本阻塞。

### 5. 地址解析与目录映射分离

标准 URL 使用 URL 解析能力处理，`user@host:path` 使用受限的 SCP 风格解析规则处理。解析结果统一为 host 和路径段；目录计算只消费该规范化结果。末尾 `.git` 仅从最后一个路径段移除，多级 GitLab group 原样保留。

所有路径段在拼接前检查空值、`.` 和 `..`，最终路径再通过相对路径校验确认仍位于 root 内。这是双层目录穿越防护。原始 URL 不重写，直接作为 `git clone` 参数，以保留协议、用户名、端口、query 和认证相关信息；这些信息不进入本地路径。

### 6. 通过参数数组启动系统 Git

使用 `spawnSync` 执行：

```text
git clone <original-url> <absolute-destination>
```

命令和参数不得通过 shell 字符串拼接。子进程 stdin 继承当前终端，以支持 SSH、Git credential helper 等交互；stdout 和 stderr 使用 pipe 捕获，并在 clone 结束后统一转发到 gpm 的 stderr，使 gpm stdout 保持机器可读。Git 启动后失败则返回其退出状态，gpm 不清理 Git 留下的文件，避免误删用户数据或隐藏诊断现场。

说明：scriptc 静态层只降低同步 `spawnSync` 的 `child_process` 表面，异步 `spawn` 的流事件 API 无法编译。因此 Git 输出在 clone 完成后统一转发，而非逐字节实时转发；这是保持 100% 静态编译的既定取舍。认证交互不受影响，因为 stdin 始终继承。`spawnSync` 使用 `encoding: "utf8"`，使捕获结果为字符串并可写回 stderr。

### 7. stdout 是结果通道，stderr 是诊断通道

help 和 version 作为直接查询命令输出到 stdout。clone 的配置路径、仓库 URL、目标路径、阶段信息、确认提示、Git 输出和错误统一写入 stderr；只有 clone 成功后，目标绝对路径写入 stdout 一次。

这允许以下调用稳定工作：

```text
repository_path="$(gpm clone https://github.com/thonatos/project-v.git)"
```

输出默认不依赖颜色表达语义，以保证重定向、日志采集和无颜色终端中的可读性。

### 8. 退出码区分参数、运行环境和 Git 失败

- `0`：命令成功。
- `1`：配置、文件系统、目标冲突或用户取消等一般运行错误。
- `2`：未知命令、缺少参数或不支持的仓库地址。
- `127`：系统找不到 git 可执行文件。
- Git 已启动后失败：返回 Git 的非零退出状态。

错误边界统一捕获可预期异常并输出简洁上下文；不得静默失败。运行时异常若无法映射到更具体状态，则返回 1。

## Clone Sequence

```text
用户              gpm                 ~/.gpmrc          文件系统             git
 │                 │                       │                 │                 │
 │ clone <url>     │                       │                 │                 │
 ├────────────────>│                       │                 │                 │
 │                 │ 读取/校验配置          │                 │                 │
 │                 ├──────────────────────>│                 │                 │
 │                 │<──────────────────────┤                 │                 │
 │                 │ 解析 URL、计算绝对目标  │                 │                 │
 │                 │ 检查目标并创建父目录    │                 │                 │
 │                 ├────────────────────────────────────────>│                 │
 │                 │<────────────────────────────────────────┤                 │
 │                 │ git clone 原始URL 绝对目标                                 │
 │                 ├──────────────────────────────────────────────────────────>│
 │<················┼··· stderr: 认证交互(实时) / Git 输出(完成后统一转发) ····┤
 │                 │<──────────────────────────────────────────────────────────┤
 │<────────────────┤ stdout: 成功后的绝对路径                                  │
```

配置不存在时，gpm 在读取阶段根据 TTY 状态选择确认并初始化，或立即提示 `gpm init` 后退出。Git 输出经 pipe 捕获后在 clone 完成后统一转发到 gpm stderr，不逐字节实时输出。

## Risks / Trade-offs

- [scriptc 仍为实验性编译器，Node API 或静态覆盖可能随版本变化] → 固定精确版本，CI 执行 coverage、构建和原生 smoke test，升级单独评估。
- [不同平台的路径和 TTY 行为存在差异] → 使用 Node 平台 API，不手工拼接分隔符；纯函数覆盖 POSIX 与 Windows 路径样例，原生产物按目标平台验证。
- [系统 Git 的输出和认证流程不可完全控制] → 继承 stdin 保证认证交互，使用 pipe 捕获并在完成后转发输出，不包装或吞掉 Git 错误。
- [scriptc 不支持异步 spawn 流事件，Git 进度非实时] → 采用 `spawnSync` 同步等待，输出在完成后统一转发；进度延迟是 100% 静态编译下的既定取舍，认证交互与退出码不受影响。
- [host 不包含凭据，而非默认端口可能形成目录映射冲突] → 首版以 hostname 作为稳定目录名；在支持同 host 多实例前，对该限制进行文档说明并通过目标已存在保护防止覆盖。
- [clone 失败可能留下部分目录] → 不自动清理，输出目标路径和 Git 错误，由用户判断；后续可单独设计显式清理能力。

## Migration Plan

1. 在 workspace 中加入 `packages/tools/*`，创建 gpm package 并锁定依赖。
2. 实现和测试配置、地址解析、路径计算、命令分派及 Git 执行边界。
3. 运行 TypeScript 检查、lint、format、单元测试和 `scriptc coverage`。
4. 构建原生二进制，在隔离 HOME、临时 root 和受控 Git fixture 下验证命令、输出与退出码。
5. 发布或安装二进制后，由用户显式运行 `gpm init`；不迁移或修改任何既有目录。

回滚时移除 gpm package、workspace 条目和新增依赖。`.gpmrc`、root 及 clone 的仓库均视为用户数据，回滚过程不删除。

## Open Questions

- 原生二进制的正式发布渠道和多平台产物矩阵尚未纳入首版范围；首版先保证 package 内可重复构建。
- 非默认 Git 服务端口目前不进入目录名；若未来需要同时管理同 host 的多个端口，应另行定义无歧义且跨平台安全的编码规则。
