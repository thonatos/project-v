# Vela Core 控制协议

Rust macOS 宿主通过 child stdin/stdout 与 `vela-core` 通信。stdout 只能包含 UTF-8 JSON Lines；Core 生命周期和诊断日志只写 stderr。单条消息不得超过 1 MiB。

## Envelope

```json
{ "version": 1, "id": "status-1", "type": "status.get", "payload": {} }
```

- `version` 当前为 `1`，其他版本返回 `unsupported_version`。
- 请求与响应通过 `id` 关联；`event.*`、`stopped` 及无法关联输入的 `error` 可省略。
- `type` 必须属于 v1 的固定消息集合。
- `payload` 是 JSON 值，具体命令的 handler 继续校验结构。

## 启动与状态快照

Core 启动后不会自行向 stdout 输出日志。宿主首先请求状态：

```json
{ "version": 1, "id": "status-1", "type": "status.get", "payload": {} }
```

Core 使用相同 ID 响应：

```json
{
  "version": 1,
  "id": "status-1",
  "type": "status",
  "payload": { "network": "offline", "sharing": false, "services": { "opencode": "checking", "dsh": "checking" } }
}
```

## 事件订阅

宿主只需订阅一次：

```json
{ "version": 1, "id": "events-1", "type": "events.subscribe", "payload": {} }
```

确认后，Core 可以发送不带 ID 的 `event.network`、`event.service`、`event.remote` 和 `event.mapping`。事件是实时增量；宿主重连后必须重新获取完整状态快照。

## 错误

可解析请求的错误回显请求 ID：

```json
{
  "version": 1,
  "id": "request-1",
  "type": "error",
  "payload": { "code": "not_implemented", "message": "message is recognized but not implemented", "retryable": false }
}
```

无法解析的输入返回无 ID error。UI 使用稳定 `code` 决定恢复操作，`message` 用于诊断，不得通过解析日志判断状态。

## 退出

```json
{ "version": 1, "id": "shutdown-1", "type": "shutdown", "payload": {} }
```

Core 停止接入、关闭映射和私人网络后发送：

```json
{ "version": 1, "type": "stopped", "payload": {} }
```

父进程管道 EOF 等同于异常退出请求；Core 必须自行清理。Rust supervisor 在等待期限后可以终止未响应的 helper，并在进入 shutdown 后禁止自动重启。

## 数据目录所有权

Core 是 `config.json` 的唯一写入者；Rust/NSH 通过控制协议读取和修改配置。目录如下：

```text
~/Library/Application Support/Vela/
  config.json
  network/
  web-data/
~/Library/Logs/Vela/
```

- `config.json` 使用同目录临时文件、文件同步、原子 rename 和目录同步。
- 损坏配置保存为 `config.json.corrupt-<UTC>`，运行时使用关闭共享的安全默认值。
- `network/` 仅由 tsnet state store 使用。
- `web-data/` 记录设备与服务 profile；Cookie 由对应的系统 WebKit data store 管理。
- 日志和复制诊断不得包含认证 URL、密钥、Cookie、Authorization header、prompt 或文件内容。

## 校验

共享 fixtures 位于 `shared/protocol/fixtures/`。验证本文件的 JSON 示例以及 Rust/Go fixtures：

```sh
sh scripts/verify-protocol-docs.sh
cargo test --locked --workspace protocol
go test -C core ./internal/protocol ./internal/control ./cmd/vela-core
```
