## ADDED Requirements

### Requirement: 根级 ErrorBoundary
当 docs-app 应用发生任何未捕获的 JavaScript 错误时，根级 ErrorBoundary SHALL 显示一个友好的错误页面，包含返回首页的链接，不暴露技术细节（如堆栈信息）。

### Requirement: 路由级 ErrorBoundary
当 `/docs/:slug` 路由的 loader 或组件抛出异常时，文档路由的 ErrorBoundary SHALL 仅捕获该路由的错误，显示文档特定的错误信息，同时保持 Header 和 Footer 导航可用。

### Requirement: 错误恢复
当用户遇到 ErrorBoundary 界面时，SHALL 提供返回首页的明确链接，使用户可以继续浏览其他内容。

### Requirement: 错误信息友好化
ErrorBoundary 界面 SHALL 使用用户可理解的文案（如"页面出错了"），不显示原始错误堆栈或 React 内部错误信息。

### Requirement: 导航可用性
路由级 ErrorBoundary 触发时，Header 和 Footer 导航链路仍然正常渲染并可交互。

### Requirement: 日志记录
当 ErrorBoundary 捕获错误时，SHALL 使用 `console.error` 记录错误信息便于调试，但不向用户展示。
