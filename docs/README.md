# 文档索引

本目录只服务仓库内的开发者与 agent。**它不是 `docs-app` 的发布内容源**；公开文章放在 `packages/apps/docs-app/app/docs/`。

维护触发表只存在于根 `AGENTS.md`，不要在这里复制。

## 编号索引

| 编号 | 文件 | 内容 |
| --- | --- | --- |
| 1 | `1-architecture.md` | 仓库与包地图、运行拓扑、依赖方向 |
| 2 | `2-development.md` | 工具链、安装、常用命令、环境变量 |
| 3 | `3-testing.md` | 测试分层、该测与不该测、证据类型 |
| 4 | `4-ci-cd.md` | workflow 触发、门禁矩阵、覆盖缺口、部署目标 |
| 5 | `5-release.md` | 发布通道、版本契约矩阵、tag、回滚 |
| 6 | `6-security.md` | 路径、临时产物、凭据与外部操作的理由 |
| 7 | `7-conventions.md` | TypeScript / Node 与 React 约定 |
| 8 | `8-runbooks.md` | change 交付与修 bug 流程 |

## 写作约定

1. **指针，不复制**：只说事实在哪里，不把代码、workflow YAML 或配置整段抄进来。
2. **命令只写 script 名**：`pnpm -F <pkg> <script>`，实现以该包 `package.json` 为准。
3. **workflow 只写路径**：不复制步骤与权限，以 `.github/workflows/<file>.yml` 为准。
4. **包清单只出现一次**：`README.md` 的包地图是唯一清单；这里只链接，不重复枚举。
5. **根文档只写跨包内容**：单包细节留在包内 `docs/` 与包级 `AGENTS.md`。
6. **不写“最近更新日期”**：内容以当前代码为准，过期就在同一个 change 内修正。

## 编号纪律

1. 编号是永久标识，不复用、不重排。
2. 新内容追加到下一个可用编号；不插队。
3. 拆分文档时新文件取新号，旧号保留为一行指针。
4. 删除内容时保留编号并标注“已废弃 / 并入 x.y”。

## 与规格的分工

- `openspec/specs/` 描述系统**应该怎样**（可观察行为与场景）。
- `docs/` 描述人/agent **怎么操作**（路径、命令、矩阵、流程）。
- 不要把行为契约抄进 `docs/`，也不要把操作步骤写进 spec。
