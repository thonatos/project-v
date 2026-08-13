## ADDED Requirements

### Requirement: gpm 命令接口

系统 SHALL 提供 `gpm init`、`gpm clone <repository-url>`、`gpm help` 和 `gpm version` 命令，并支持 `-h`、`--help`、`-v` 和 `--version` 的常规别名。

#### Scenario: 显示顶层帮助
- **GIVEN** gpm 可执行文件可用
- **WHEN** 用户执行 `gpm help`、`gpm -h` 或 `gpm --help`
- **THEN** 系统 SHALL 显示用法、四个命令、配置格式和 clone 示例并以状态码 0 退出

#### Scenario: 显示 clone 帮助
- **GIVEN** gpm 可执行文件可用
- **WHEN** 用户执行 `gpm help clone` 或 `gpm clone --help`
- **THEN** 系统 SHALL 显示 `gpm clone <repository-url>` 的用法、支持的地址形式和目标路径规则并以状态码 0 退出

#### Scenario: 显示版本
- **GIVEN** gpm 构建时已确定版本
- **WHEN** 用户执行 `gpm version`、`gpm -v` 或 `gpm --version`
- **THEN** 系统 SHALL 以 `gpm <version>` 格式输出版本并以状态码 0 退出

#### Scenario: 拒绝未知命令
- **GIVEN** 用户提供的首个参数不是受支持的命令或别名
- **WHEN** gpm 解析命令行
- **THEN** 系统 SHALL 将未知命令和简要用法写入 stderr 并以状态码 2 退出

#### Scenario: clone 缺少仓库地址
- **GIVEN** 用户未提供仓库地址
- **WHEN** 用户执行 `gpm clone`
- **THEN** 系统 SHALL 将参数错误和 `gpm clone <repository-url>` 用法写入 stderr 并以状态码 2 退出

### Requirement: 配置初始化

系统 SHALL 使用当前用户主目录中的 `.gpmrc` 作为配置文件，并由 `gpm init` 创建默认配置和 root 目录。默认 root SHALL 是通过当前用户主目录计算出的绝对 `<home>/gpm` 路径，配置内容 SHALL 采用 `{"root":["<absolute-path>"]}` JSON 结构。

#### Scenario: 初始化默认配置
- **GIVEN** `~/.gpmrc` 不存在
- **WHEN** 用户执行 `gpm init`
- **THEN** 系统 SHALL 创建 `~/.gpmrc`、创建绝对的 `<home>/gpm` 目录、输出配置和 root 的绝对路径并以状态码 0 退出

#### Scenario: 默认配置写入绝对路径
- **GIVEN** 当前用户主目录可以被解析
- **WHEN** `gpm init` 写入默认配置
- **THEN** `root` SHALL 只包含一个展开后的绝对 `<home>/gpm` 路径且 SHALL NOT 包含 `~` 或相对路径片段

#### Scenario: root 目录已存在
- **GIVEN** `~/.gpmrc` 不存在但默认 root 目录已经存在
- **WHEN** 用户执行 `gpm init`
- **THEN** 系统 SHALL 保留该目录及其内容并只创建配置文件

#### Scenario: 配置已存在
- **GIVEN** `~/.gpmrc` 已存在
- **WHEN** 用户执行 `gpm init`
- **THEN** 系统 SHALL NOT 覆盖配置文件，并 SHALL 将错误写入 stderr 后以状态码 1 退出

### Requirement: 配置读取与严格校验

执行 clone 时，系统 SHALL 将 `.gpmrc` 解析为 JSON，并要求 `root` 是只包含一个非空绝对路径的字符串数组。系统 SHALL 在执行 Git 或创建仓库父目录之前拒绝无效配置。

#### Scenario: 读取有效配置
- **GIVEN** `.gpmrc` 内容为 `{"root":["/absolute/workspace"]}`
- **WHEN** 用户执行 `gpm clone <repository-url>`
- **THEN** 系统 SHALL 使用 `/absolute/workspace` 作为唯一的仓库根目录

#### Scenario: JSON 无效
- **GIVEN** `.gpmrc` 不是合法 JSON
- **WHEN** 用户执行 clone
- **THEN** 系统 SHALL 报告配置文件路径和 JSON 解析错误，并 SHALL 在不执行 Git 的情况下以状态码 1 退出

#### Scenario: root 数量不是一个
- **GIVEN** `.gpmrc` 中的 `root` 为空数组或包含多个元素
- **WHEN** 用户执行 clone
- **THEN** 系统 SHALL 报告 `root` 必须只包含一个路径，并 SHALL 在不执行 Git 的情况下以状态码 1 退出

#### Scenario: root 不是绝对路径
- **GIVEN** `.gpmrc` 中唯一的 root 是 `~/gpm`、`gpm`、`./gpm` 或空字符串
- **WHEN** 用户执行 clone
- **THEN** 系统 SHALL 报告 root 必须是非空绝对路径，并 SHALL 在不执行 Git 的情况下以状态码 1 退出

### Requirement: clone 时处理缺失配置

系统 SHALL 在 `gpm clone` 发现 `.gpmrc` 不存在时引导用户创建默认配置。交互式终端中 SHALL 请求确认并可继续 clone，非交互环境中 SHALL 立即提示先运行 `gpm init`。

#### Scenario: 交互确认创建配置
- **GIVEN** `.gpmrc` 不存在且标准输入是交互式终端
- **WHEN** 用户执行 clone 并确认创建默认配置
- **THEN** 系统 SHALL 执行与 `gpm init` 相同的初始化行为并继续本次 clone

#### Scenario: 交互拒绝创建配置
- **GIVEN** `.gpmrc` 不存在且标准输入是交互式终端
- **WHEN** 用户拒绝创建默认配置
- **THEN** 系统 SHALL 不创建配置或 root，并 SHALL 以状态码 1 退出

#### Scenario: 非交互环境缺少配置
- **GIVEN** `.gpmrc` 不存在且标准输入不是交互式终端
- **WHEN** 用户执行 clone
- **THEN** 系统 SHALL NOT 等待输入，并 SHALL 提示运行 `gpm init`、显示期望的配置格式并以状态码 1 退出

### Requirement: Git 仓库地址解析

系统 SHALL 支持 HTTP、HTTPS、`git://`、`ssh://` 和 `user@host:path` SCP 风格的 Git 仓库地址，并 SHALL 将地址规范化为 host 和仓库路径。仓库路径 SHALL 保留多级 group，移除末尾 `.git`，且 SHALL NOT 包含空段、`.` 或 `..` 路径段。

#### Scenario: 解析 HTTPS 地址
- **GIVEN** 仓库地址为 `https://github.com/thonatos/project-v.git`
- **WHEN** gpm 解析地址
- **THEN** 系统 SHALL 得到 host `github.com` 和仓库路径 `thonatos/project-v`

#### Scenario: 解析 SCP 风格 SSH 地址
- **GIVEN** 仓库地址为 `git@github.com:thonatos/project-v.git`
- **WHEN** gpm 解析地址
- **THEN** 系统 SHALL 得到 host `github.com` 和仓库路径 `thonatos/project-v`

#### Scenario: 保留多级 group
- **GIVEN** 仓库地址为 `https://gitlab.example.com/team/platform/project.git`
- **WHEN** gpm 解析地址
- **THEN** 系统 SHALL 得到仓库路径 `team/platform/project`

#### Scenario: 拒绝不支持或不安全的地址
- **GIVEN** 输入是 `owner/repository`、本地文件路径、缺少 host 的地址或包含 `.`、`..` 路径段的地址
- **WHEN** gpm 解析地址
- **THEN** 系统 SHALL 报告受支持的地址形式，并 SHALL 在不创建目录或执行 Git 的情况下以状态码 2 退出

### Requirement: 确定性目标目录

系统 SHALL 将 clone 目标计算为 `<root>/<host>/<repository-path>` 的绝对路径，并 SHALL 验证最终路径位于配置的 root 内。

#### Scenario: 生成 GitHub 仓库目录
- **GIVEN** root 为 `/Users/example/gpm` 且仓库为 `git@github.com:thonatos/project-v.git`
- **WHEN** gpm 计算目标目录
- **THEN** 目标 SHALL 是 `/Users/example/gpm/github.com/thonatos/project-v`

#### Scenario: 创建缺失的父目录
- **GIVEN** 配置有效且目标仓库的父目录不存在
- **WHEN** gpm 开始 clone
- **THEN** 系统 SHALL 递归创建 root、host 和 group 父目录后执行 Git

#### Scenario: 目标目录已经存在
- **GIVEN** 计算出的目标目录已经存在
- **WHEN** 用户执行 clone
- **THEN** 系统 SHALL NOT 覆盖、删除或更新该目录，并 SHALL 报告目标绝对路径后以状态码 1 退出

### Requirement: 使用系统 Git 克隆

系统 SHALL 以参数数组调用 PATH 中的系统 `git clone <original-url> <absolute-destination>`，不得通过 shell 拼接命令。系统 SHALL 保留 Git 的交互式标准输入，捕获 Git 的 stdout 和 stderr，并在 clone 结束后统一转发到 gpm 的 stderr。

#### Scenario: 成功克隆仓库
- **GIVEN** 配置和仓库地址有效、目标不存在且系统 Git 可用
- **WHEN** Git clone 成功
- **THEN** 系统 SHALL 保留 Git 的认证交互，将 Git 输出与完成信息写入 stderr，将目标绝对路径写入 stdout，并以状态码 0 退出

#### Scenario: Git 不存在
- **GIVEN** PATH 中不存在 git 可执行文件
- **WHEN** gpm 尝试 clone
- **THEN** 系统 SHALL 将明确错误写入 stderr 并以状态码 127 退出

#### Scenario: Git clone 失败
- **GIVEN** Git 已启动但以非零状态退出
- **WHEN** clone 失败
- **THEN** 系统 SHALL 保留 Git 原始错误输出、返回 Git 的退出状态，并 SHALL NOT 自动删除或修改 Git 留下的目标内容

### Requirement: 可脚本化输出

系统 SHALL 将状态、进度、提示和错误写入 stderr；成功的 clone SHALL 只在 stdout 输出目标仓库绝对路径并以换行结束。输出 SHALL 在禁用颜色或重定向时仍保持完整可读。

#### Scenario: shell 捕获成功结果
- **GIVEN** clone 成功
- **WHEN** 调用方捕获 gpm 的 stdout
- **THEN** 捕获值 SHALL 只包含目标仓库绝对路径，且状态信息与 Git 输出 SHALL 仍可通过 stderr 观察

#### Scenario: clone 前显示必要信息
- **GIVEN** 配置与仓库地址有效
- **WHEN** gpm 即将启动 Git
- **THEN** 系统 SHALL 在 stderr 显示配置路径、原始仓库地址和目标绝对路径

#### Scenario: 失败不输出成功路径
- **GIVEN** 配置、地址或 Git clone 任一阶段失败
- **WHEN** gpm 退出
- **THEN** 系统 SHALL NOT 在 stdout 输出成功目标路径

### Requirement: 原生构建与运行

gpm SHALL 使用固定精确版本的 `scriptc` 将 TypeScript 入口编译为原生可执行文件。原生产物 SHALL 不依赖 Node.js 或 `node_modules`，且 SHALL 在运行时使用系统 Git。

#### Scenario: 静态覆盖检查
- **GIVEN** gpm TypeScript 源码及依赖已安装
- **WHEN** 开发者运行 package 的 coverage 检查
- **THEN** `scriptc coverage` SHALL 报告程序可在不启用 `--dynamic` 的情况下构建

#### Scenario: 构建原生二进制
- **GIVEN** 构建环境满足 scriptc 和 clang 要求
- **WHEN** 开发者运行 gpm package 的 build 脚本
- **THEN** 系统 SHALL 在 package 的 `dist` 目录生成可执行的 `gpm` 原生产物

#### Scenario: 无 Node 运行
- **GIVEN** gpm 已构建且系统 Git 可用
- **WHEN** 用户在没有 Node.js 和 `node_modules` 的环境执行 `gpm help` 或 `gpm version`
- **THEN** 命令 SHALL 正常运行
