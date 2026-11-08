# footer-brand Specification

## Purpose
定义站点 Footer 中项目描述、技术栈品牌和视觉一致性要求，使页脚在不同页面都能稳定表达产品身份与实现信息。

## Requirements

### Requirement: Footer 显示项目描述

系统 MUST 在 Footer 右侧显示品牌名称 `ρV` 与描述 `undefined project.`，并在左侧显示当前版权年份。

#### Scenario: Footer 显示项目描述文字

- **GIVEN** 用户查看任意站点页面
- **WHEN** Footer 进入视口
- **THEN** Footer 左侧显示 `©` 与当前年份
- **THEN** Footer 右侧显示 `ρV` 和 `undefined project.`
