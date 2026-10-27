# 8. 流程手册

## 8.1 Change 交付

### 1. 开工

1. 读根 `AGENTS.md` 的「开工例程」。
2. 定位受影响包，读该包最近的 `AGENTS.md`，取出「验证入口」与「CI 映射」。
3. 判断是否改变可观察行为、跨包契约或交付物：是则进入 change；否则直接修改，但仍要执行触发表与完成定义。

### 2. 规划

```bash
/opsx-propose <change-name>
```

`proposal.md` 必须包含五行 `Delivery Impact`：长期文档、入口文档、版本（逐包）、发布、验收。纯文档或工具改动在 `.openspec.yaml` 设 `skip_specs: true`。

`tasks.md` 的规则：

- 每个任务写出可执行验证（命令、workflow/job 或可观察结果）。
- 每个任务组自带本组测试与文档；跨组集成、CI、发布、验收只放在最后一组。
- 交付组按 `docs/4-ci-cd.md` 与 `docs/5-release.md` 裁剪，不涉及的项写明“不适用 + 原因”。
- 归档后才发生的动作放 `## Workflow follow-up`。

### 3. 执行

```bash
/opsx-apply <change-name>
```

- 代码与文档在同一组完成，不攒到最后。
- 勾选任务前确认它引用的命令刚刚真实执行过。
- 范围变化时回到 `proposal.md` 的 `Delivery Impact` 重新评估，并更新 `tasks.md`。
- 触及新的包时，补做该包的版本评估。

### 4. 归档前核对

- 逐条复核 `Delivery Impact`：标“需要”的已完成，标“不需要”的仍成立。
- 对本次改过的文档逐条确认：引用的路径存在、脚本名存在、包地图与实际目录一致。
- 版本项逐包复核；`NONE` 的理由仍成立。
- 与本次无关的文档漂移只报告，不擅自扩大范围。

```bash
openspec archive <change-name>
```

### 5. 提交与 CI

- 提交并推送，等待对应 workflow 通过（见 `docs/4-ci-cd.md`）。
- 不跳过 hooks，不用 `--no-verify`。

### 6. 版本与发布

按 `docs/5-release.md`：

1. 对每个受影响包判定 `MAJOR / MINOR / PATCH / NONE`。
2. 需要更新版本时，同步该包列出的全部来源文件，并运行版本测试。
3. 需要发布时，按 5.1 的通道执行：tag → Draft Prerelease → 人工公开 → feed；或 Docker / `wrangler deploy` / npm。
4. 不发布时，在最终说明中记录“未触发发布”的依据。

### 7. 验收

- 用 `docs/3-testing.md` 的证据类型记录实际结果。
- Vela 的 iOS 验收只在归档前收集；归档后不再启动 Simulator。
- 部署类改动在目标环境复查 URL 或命令输出，不只依赖本地构建。

## 8.2 修 Bug

1. **复现**：记录实际结果与预期结果，确认不是环境或输入问题。
2. **对比**：找到同类正常路径，逐层比较数据、状态、布局和平台链路。
3. **定位最小根因 owner**：确认是共享实现违反契约，还是调用点的局部输入或父级结构问题。
4. **修改**：只改这个 owner；共享实现只在契约本身被违反时修改。
5. **测试**：增加会在旧实现失败、在所有合法实现通过的行为测试；UI 用 bounds、目标平台交互或产品页面截图验证。
6. **验证**：先跑受影响包的专项命令，再按变更范围跑 package 或 workspace 聚合检查。

不要用连续增加 wrapper、宽度、间距或特殊分支的方式试错；也不要把 headless 或模拟器结果描述为真机结果。
