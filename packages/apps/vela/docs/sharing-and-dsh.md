# 本机共享与 DSH authority

Vela 共享你自己添加的 loopback 服务。OpenCode 与 DSH 只是添加服务时的预设，新安装不会预置任何服务：

| 预设 | 本机地址 | Vela 私人端口 |
|---|---|---|
| OpenCode V2 | `127.0.0.1:49374` | `47845` |
| DSH | `127.0.0.1:3080` | `47846` |

控制清单使用私人端口 `47844`。这些端口仅存在于 Vela 的嵌入式 tailnet node，不监听局域网或公网。Vela 只接受 `localhost`、`127.0.0.1` 或 `::1` 的 HTTP 目标，不接受远端提供任意 target，也不启动、停止或重新配置被共享的服务。

## 安全边界

- 远端连接必须先通过 Tailscale WhoIs 和 Vela 授权策略。
- 被共享服务自身的配对、密码、token 和 Cookie 继续生效。
- 关闭“共享这台 Mac”只关闭 Vela listener，不影响本机服务。
- Vela 不修改系统 VPN、代理、DNS 或路由。

访问端的转发地址只监听本机 loopback，但本机其他进程与浏览器扩展同样可达，暴露面与在本机直接运行该服务相同；跨设备方向仍需通过授权检查。

### TCP 服务

TCP 服务（SSH、Redis、MySQL、PostgreSQL 或自定义 TCP）按原始字节转发，Vela 不解析也不改写内容。安全边界与 Web 服务相同，另有几点：

- 目标同样只允许 loopback，Vela 不会成为能拨任意地址的 TCP 跳板。
- Vela 不参与这些服务的认证。SSH 密钥、数据库密码都由服务自己校验，请保持它们启用。
- 可用性检查不会连接服务，只检查端口是否在监听，因此不会在 `sshd` 日志中留下记录，也不会累计 MySQL 的失败握手次数。
- 共享 SSH 等同于把这台 Mac 的命令行开放给已授权的设备。首次共享时 Vela 会单独提示。

## DSH

DSH 会校验 Host、Origin 与可信 authority。访问端通过 Vela 的 `<服务>-<设备>.localhost` 映射访问 DSH；Vela 把同源 authority 规范化为 `127.0.0.1:3080`，不会删除 Origin 或绕过 DSH 的认证。`.localhost` 子域由 RFC 6761 保留给 loopback，因此与裸 `127.0.0.1` 同样被视为本机。

若 DSH 明确返回 trusted-host 拒绝，应按 DSH 当前版本的提示，将 Vela 显示的私人 authority 加入 trusted hosts；该设置属于 DSH，不由 Vela 静默修改。

启动示例：

```sh
dsh web --port 3080 --no-open
```

验证本机服务：

```sh
curl -I http://127.0.0.1:49374/api/info
curl -I http://127.0.0.1:3080/
```

只有服务真实运行时才能完成端到端手动验证。
