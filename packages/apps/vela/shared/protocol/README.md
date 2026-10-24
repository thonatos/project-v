# Vela protocol

此目录存放 Rust 宿主与 Go Core 共用的版本化 JSON Lines fixtures，以及 Vela 设备之间的清单契约。实现不得通过解析日志推导状态。

每条控制消息独占一行 UTF-8 JSON，并包含：

- `version`：当前固定为 `1`；
- `id`：请求及其响应的关联 ID；异步 `event.*`、最终 `stopped` 事件及无法关联请求的 `error` 可省略；
- `type`：受版本控制的消息类型；
- `payload`：由消息处理器继续校验的业务对象。

结构化错误使用 `error` 类型，payload 包含稳定的 `code`、用户可读 `message` 和 `retryable`。Rust 与 Go 测试必须共同读取 `fixtures/`，保证 envelope、未知版本和未知类型行为一致。
