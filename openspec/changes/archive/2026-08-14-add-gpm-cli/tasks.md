## 1. Workspace 与工具包基础

- [x] 1.1 在 `pnpm-workspace.yaml` 中加入 `packages/tools/*`，并创建 `packages/tools/gpm` workspace 包
- [x] 1.2 为 gpm 配置 TypeScript、测试、lint、format、`scriptc coverage` 和原生 build 脚本
- [x] 1.3 以精确版本加入 `scriptc` 开发依赖并更新 `pnpm-lock.yaml`
- [x] 1.4 建立 `src/main.ts` CLI 入口、构建时版本常量和 `dist` 产物忽略规则

## 2. 命令接口与输出协议

- [x] 2.1 实现 `init`、`clone`、`help`、`version` 命令分派及 `-h`、`--help`、`-v`、`--version` 别名
- [x] 2.2 实现顶层与 clone 帮助文本、缺少参数和未知命令诊断，并按规格返回 0、1、2、127 或 Git 退出码
- [x] 2.3 建立 stdout 结果通道和 stderr 状态/诊断通道，确保失败时 stdout 不输出成功路径
- [x] 2.4 添加命令分派、帮助、版本、输出通道及退出码的自动化测试

## 3. 配置初始化与校验

- [x] 3.1 实现基于当前用户 home 的 `.gpmrc` 路径和绝对 `<home>/gpm` 默认 root 计算
- [x] 3.2 实现 `gpm init`，创建单行 JSON 配置与 root 目录，同时拒绝覆盖已有配置并保留已有 root 内容
- [x] 3.3 将 `JSON.parse` 结果作为 `unknown` 严格校验，要求 `root` 是只含一个非空绝对路径的字符串数组
- [x] 3.4 实现 clone 缺少配置时的 TTY 确认初始化，以及非交互环境中提示运行 `gpm init` 的非阻塞失败
- [x] 3.5 使用隔离 HOME 和临时目录测试初始化、已有配置、已有 root、无效 JSON、root 数量及绝对路径约束

## 4. 仓库地址与目标路径

- [x] 4.1 实现 HTTP、HTTPS、`git://`、`ssh://` 和 SCP 风格 Git 地址到 host 与路径段的规范化解析
- [x] 4.2 实现末尾 `.git` 移除、多级 group 保留，以及空段、`.`、`..`、本地路径和不支持形式的拒绝逻辑
- [x] 4.3 实现 `<root>/<host>/<repository-path>` 绝对目标计算和 root 边界校验
- [x] 4.4 添加各协议、多级 group、恶意路径、无效地址和确定性目标目录的表驱动测试

## 5. Git Clone 执行

- [x] 5.1 在目标不存在时递归创建父目录，并在目标已经存在时无修改地失败
- [x] 5.2 使用参数数组且不经 shell 启动 `git clone <original-url> <absolute-destination>`，继承 stdin 并将 Git stdout/stderr 实时转发到 gpm stderr
- [x] 5.3 实现 Git 不存在时返回 127、Git 失败时透传其退出状态，并保留失败后留下的目标内容
- [x] 5.4 使用受控的假 Git 可执行文件测试参数传递、认证输入通道、实时输出、成功路径、失败状态和不清理行为

## 6. 原生构建与验收

- [x] 6.1 运行 gpm 的 TypeScript 检查、单元测试、仓库 lint 和 format 检查并修复全部问题
- [x] 6.2 运行 `scriptc coverage`，消除静态编译阻塞并确认无需 `--dynamic`
- [x] 6.3 构建 `dist/gpm` 原生二进制，并验证可执行权限、`help`、`version` 和参数错误行为
- [x] 6.4 在隔离 HOME、临时绝对 root 和本地受控 Git 远端下，对原生二进制执行 `init` 与成功/失败 clone 端到端测试
- [x] 6.5 验证原生二进制运行时不读取 Node.js 或 `node_modules`，并记录系统 Git 与构建工具链要求
