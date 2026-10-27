# Sparkle 测试密钥

本目录只包含公开、确定性的测试 fixture，绝不能用于 Vela Release。

`test-ed25519-private-key.txt` 是由 32 个零字节组成的 Ed25519 测试种子（base64）。它只用于证明签名、篡改拒绝和错误密钥测试，任何人都可以读取并伪造它的签名。

生产私钥不得写入仓库、测试输出或构建 Artifact，只能由受保护的 GitHub environment 在稳定 feed 发布 job 中通过标准输入交给 Sparkle `sign_update`。
