## 1. 命令发现

- [x] 1.1 在 Telegram 客户端启动时清理旧命令并为三个标准 scope 注册五个支持命令
- [x] 1.2 扩展命令解析与帮助内容，支持 `/workspace` 选择卡片

## 2. Workspace 路由

- [x] 2.1 让 Session 创建、恢复、`/new` 和 `/status` 使用当前绑定的 Workspace
- [x] 2.2 实现 Workspace 校验和统一切换事务，成功后更新绑定并释放旧句柄
- [x] 2.3 实现 Workspace 选择卡片和 Owner-only callback 路由

## 3. 验证

- [x] 3.1 增加命令注册、选择卡片、callback 和失效 Workspace 测试
- [x] 3.2 运行插件测试、构建、打包 dry-run 和 OpenSpec 验证
