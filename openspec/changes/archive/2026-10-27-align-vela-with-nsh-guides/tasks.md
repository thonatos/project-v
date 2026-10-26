# Tasks

## 1. 规范冲突与响应式测试基线

- [x] 1.1 更新 Vela 的规范/结构测试断言，统一设备行不显示地址、只出现一次状态文字并允许装饰性状态图形、固定 macOS 工具窗不提供全屏；运行对应 macOS/iOS structure tests 验证旧冲突已消失。
- [x] 1.2 为 store 增加可控 deferred promise 与 fake clock 测试夹具，覆盖原子快照、重叠刷新 latest-wins、刷新状态归属和 timer cleanup；运行新增 headless tests 验证当前缺陷可被稳定复现。

## 2. Store 写入边界与响应式模型

- [x] 2.1 在 macOS store 中增加只读 accessor facade 和按日志、重命名、添加设备、服务编辑、导航分组的语义命令，将底层 signal 留在构造闭包内；迁移 macOS 页面并以结构测试确认 feature/App 不再调用 store signal 的 `.set()`。
- [x] 2.2 在 iOS store 中增加只读 accessor facade 和按日志、重命名、modal、页面浏览及导航分组的语义命令；将 `menuOpen`、WebView ref 等单组件临时状态移入组件 owner，并以结构测试确认页面不再直接写 store signal 或保留模块级临时状态。
- [x] 2.3 将两端共享或非平凡派生值（候选设备、服务 rows、设备 groups、当前服务、选中设备和身份投影）改为 `computed`，保留轻量单次 closure；以计数型单元测试验证一次源变化只执行一次排序/分组并向多个消费者返回一致结果。
- [x] 2.4 用 `batch` 包装打开/关闭服务、页面切换、表单初始化/重置、status snapshot 应用和认证阶段等多字段事务；运行状态快照测试，确认订阅者只观察到提交后的完整状态。
- [x] 2.5 重构共享 flows 的内部写入端口和测试构造方式，使可写 `Signal<T>` 仅在 store 内组装且页面无法导入；运行 `node shared/ui/flows.test.mjs` 与两端 `nsh check` 验证流程行为和类型边界。

## 3. 异步新鲜度与生命周期

- [x] 3.1 为 macOS status、remote 和 diagnostics 操作加入统一的 promise/revision controller，保留刷新期间旧数据并拒绝过期提交；运行乱序完成测试和现有 forwarding stale-attempt 测试验证结果。
- [x] 3.2 为 iOS status、remote 和 diagnostics 操作加入统一的 promise/revision controller，确保旧请求不能覆盖新数据或提前清除 refreshing；运行乱序完成、失败后保留数据和重复触发测试。
- [x] 3.3 让两端 store 启动过程提供统一停止路径，并将 poll、retry、copy feedback 与 diagnostics interval 的 cleanup 绑定根 owner；为 `BrowserPage` 延迟 reload 增加 effect cleanup，运行 fake-clock 测试确认卸载后没有回调或状态写入。

## 4. NSH 语义组件与交互状态

- [x] 4.1 用 `nsh/base` 的 `Menu`、`MenuItem` 与 separator/分组能力替换 iOS `Sheet + Button` 自建菜单，给菜单项目稳定 id 并保留现有底部呈现、危险项与关闭行为；运行 iOS target test 验证选择、背景/返回关闭和焦点恢复。
- [x] 4.2 将 macOS 可点击 `ListRow` 迁到可聚焦的 base press/button primitive，保持现有布局与视觉 wrapper；运行 target test 验证 Tab、Space/Enter、disabled、selected announcement 和整行导航。
- [x] 4.3 将 macOS `Segmented` 与 `RadioGroup` 迁到当前 NSH 类型声明支持的标准 Tab/Radio 行为；若版本缺失必要 primitive，则在 wrapper 中补齐完整键盘模型并记录原因，运行方向键、唯一选中、checked/selected 与辅助角色测试。
- [x] 4.4 将 macOS Button 默认 variant 改为普通/default 语义，逐个标记真正的决策区 primary commit，并为 rail/navigation 传递 selected 状态；运行页面结构和 accessibility target tests 验证主次层级及当前页宣布。
- [x] 4.5 审计保留的 macOS/iOS native controls，补齐受控值、disabled、accessibility label/state 和平台激活契约；运行两端 native control/host tests 验证包装层与原生事件一致。

## 5. 运行时主题与视觉尺度

- [x] 5.1 将两端共享和平台语义角色迁入 `nsh.json.theme`，更新主题同步/生成校验，使 `shared/tokens/base.json` 仍是共享品牌输入；运行两端 theme tests 与 `nsh check` 验证所有 token 存在且 light/dark 对比度达标。
- [x] 5.2 将 TSX 组合类改为直接引用 runtime theme tokens，删除以 `dark:` 拼接同一语义角色的颜色组合；运行 unknown-class 检查和 light/dark target screenshots 验证视觉语义保持。
- [x] 5.3 使用响应式 `token()` 为 SF Symbols、UISwitch 和其他原生颜色参数供值，删除 iOS `nativeColor` raw hex 副本；运行 host theme override 测试验证运行时切换会同步更新 TSX 与原生控件。
- [x] 5.4 盘点 `h-[52px]`、dialog width/height、日志列宽和状态栏/WebView 几何等字面值，将普通布局迁入命名 token/size variant，并为保留的平台边界补注释和几何测试；运行两端 structure 与 representative-bounds tests 验证无未审计任意值。
- [x] 5.5 在默认与增大文字比例下验证页面标题、列表、按钮、sheet、焦点环和固定 macOS 窗口，修正固定高度导致的裁切或不可达操作；运行 font-scale target tests 和代表性截图对比。

## 6. Capabilities、安全边界与文档

- [x] 6.1 审计 macOS 的 Clipboard、外部 URL 与宿主原生调用，为 `macos/ui/nsh.json` 添加最小 capabilities 并在命令层呈现拒绝反馈；运行 capability build/test 验证所需操作成功、未声明操作被拒绝。
- [x] 6.2 审计 iOS 的 Clipboard、WebView、status bar 与宿主原生调用，为 `ios/ui/nsh.json` 添加最小 capabilities，并限制可信 WebView native component 只导航当前映射上下文；运行拒绝与越界导航测试验证失败可恢复且不能访问任意目标。
- [x] 6.3 更新 Vela 开发与架构文档，记录 store 写入边界、native component 信任边界、主题/几何例外和 capabilities，并统一 README、`scripts/nsh.sh` 与验证脚本中的 NSH 版本；运行 `scripts/verify-docs.sh` 验证路径、命令和版本一致。

## 7. 集成验证

- [x] 7.1 将新增 headless 与 NSH target tests 接入 `verify-common.sh`、`verify-macos.sh`、`verify-ios.sh` 和 release gate，运行 verify-gates test 确认本地与 CI 仍复用唯一清单。
- [x] 7.2 运行 `pnpm -F vela verify`，确认共享 flows、两端 `nsh check`、Rust fmt/test/clippy、Go race tests、结构/主题和新增交互检查全部通过。
- [x] 7.3 在 macOS 主窗口与 iOS 模拟器/设备完成 smoke test，验证键盘或触摸导航、VoiceOver/辅助状态、overlay、外观/宿主主题、减少动态效果、远端刷新与服务打开；保存测试报告并确认 Core 协议和用户数据无需迁移。

## 8. Gravatar 头像

- [x] 8.1 由 Core 通过宿主 HTTP 客户端下载 Gravatar 并返回 data URL，写入两端 store 的只读 `avatarSource` signal；关闭偏好或头像缺失时清空 signal。
- [x] 8.2 移除 TSX 不再需要的 Gravatar network capability，并运行两端 `nsh check`、结构测试和 capability test。

## 9. 测试治理

- [x] 9.1 收缩 macOS/iOS UI 结构测试，仅保留依赖、native bridge、store 写入和视觉值等稳定静态边界；删除 JSX/class、私有函数、局部变量和源码行数断言，并运行两端结构检查。
- [x] 9.2 删除 capabilities/theme 测试中对 Rust 私有函数和具体 token 调用的锁定，改由现有 Rust policy、theme 配置与 target 行为测试承担；运行对应专项测试。
- [x] 9.3 将 macOS `product-visual` 测试改为明确受限的 development-host shell smoke，移除正式产品截图表述，并更新验证门与测试文档；运行 verify-gates 和完整 `pnpm -F vela verify`。

## 10. Tailscale 代理设置

- [x] 10.1 新增默认开启并可迁移的 `tailscaleProxy` 偏好，在 macOS 设置页提供原生开关并明确重启后生效。
- [x] 10.2 macOS host 启动 `vela-core` 时读取偏好；关闭时仅为 helper 设置 `TS_DISABLE_FEATURE=useproxy`，保留其他禁用 feature 且不影响头像 HTTP。
- [x] 10.3 运行配置迁移、host、共享 flow、两端 `nsh check` 与完整 Vela verify，并安装 macOS review build 验证进程环境。

## 11. 版本治理

- [x] 11.1 按 SemVer 将本次向后兼容的新功能评估为 MINOR，统一更新 Vela 至 `0.2.0 (2)`；增强正式元数据一致性测试，并从已安装 macOS bundle 与 iPhone 设备回读版本。
- [x] 11.2 在 `packages/apps/vela/AGENTS.md` 加入强制版本评估、SemVer 判定、Apple build 递增、正式版本源同步和安装后回读规则。

## Workflow follow-up

- 完成评审与验收后归档该 change，并确认三个主规格已合并为无冲突契约。
