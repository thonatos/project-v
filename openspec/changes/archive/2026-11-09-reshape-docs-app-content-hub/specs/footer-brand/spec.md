# Spec Delta

## MODIFIED Requirements

### Requirement: Footer 显示项目描述

系统 MUST 在 Footer 右侧显示品牌名称 `ρV` 与描述 `undefined project.`，并在左侧显示当前版权年份。

#### Scenario: Footer 显示项目描述文字

- **GIVEN** 用户查看任意站点页面
- **WHEN** Footer 进入视口
- **THEN** Footer 左侧显示 `©` 与当前年份
- **THEN** Footer 右侧显示 `ρV` 和 `undefined project.`

## REMOVED Requirements

### Requirement: Footer 显示技术栈品牌标识

**Reason**: React Router 技术栈宣传与读者任务无关，并重复占用页脚层级。

**Migration**: Footer 仅保留版权年份与站点品牌信息，不提供技术栈外链。

### Requirement: Footer 品牌样式一致

**Reason**: 旧要求专门约束已删除的 React Router 品牌链接，不再适用。

**Migration**: Footer 的版权和站点品牌继续使用全站文字与主题 token。
