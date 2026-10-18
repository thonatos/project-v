# docs-hydration-safety Specification

## Purpose
定义文档应用中依赖运行时日期数据的组件渲染约束，避免服务端与客户端输出不一致引起 hydration 警告或界面闪烁。

## Requirements

### Requirement: Footer 年份 Hydration 安全
系统 SHALL 使用客户端渲染年份，避免服务端/客户端渲染不一致导致的 hydration 错误。

#### Scenario: 年份客户端渲染
- **WHEN** Footer 组件渲染
- **THEN** 年份通过 useEffect 在客户端计算并渲染

#### Scenario: 无 hydration 错误
- **WHEN** 页面完成 hydration
- **THEN** 无 hydration mismatch 错误日志

#### Scenario: 年份显示正确
- **WHEN** 用户查看 Footer 版权信息
- **THEN** 显示当前年份（客户端渲染结果）
