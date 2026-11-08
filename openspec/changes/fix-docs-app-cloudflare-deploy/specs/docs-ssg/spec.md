# Spec Delta

## MODIFIED Requirements

### Requirement: 生产环境静态站点部署
系统 SHALL 将 `build/client/` 作为名为 `docs-app` 的 Cloudflare Worker 静态资源部署，并使用配置中固定的有效兼容日期；push `main` SHALL 触发 connected build，人工部署命令 SHALL 使用同一份配置。

#### Scenario: 部署静态站点
- **GIVEN** `main` 包含有效的 docs-app Worker 配置和成功的生产构建
- **WHEN** Cloudflare connected build 执行 `wrangler deploy`
- **THEN** 平台 SHALL 将 `build/client/` 发布到名为 `docs-app` 的 Worker
- **THEN** Wrangler SHALL 不报告 Worker 名称不匹配或缺少兼容日期

#### Scenario: 页面无 API 调用
- **GIVEN** docs-app 已成功部署
- **WHEN** 用户访问生产环境页面
- **THEN** 页面数据 SHALL 已嵌入静态 HTML，无需额外 API 获取

#### Scenario: 人工补发使用相同配置
- **GIVEN** connected build 需要人工补发或验证
- **WHEN** 维护者执行 `pnpm -F docs-app deploy`
- **THEN** Wrangler SHALL 使用仓库内同一 Worker 名称、兼容日期和静态资源目录配置

#### Scenario: 部署失败不视为发布完成
- **GIVEN** Cloudflare connected build 或 `wrangler deploy` 返回失败
- **WHEN** 维护者评估发布状态
- **THEN** 本次发布 SHALL 视为未完成
- **THEN** 维护者 SHALL 修复失败并重新触发部署后再进行生产验收
