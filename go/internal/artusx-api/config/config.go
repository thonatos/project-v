// Package config 从环境变量读取 artusx-api 运行所需配置。
package config

import (
	"os"

	"github.com/joho/godotenv"
)

// Config 汇总服务运行期配置。
//
// 环境变量复用旧 Node 版命名，webhook 仅用到 info/idea 两个 channel
// （madrid 与 info 接口均推送到 info channel）。
type Config struct {
	// Port 为服务监听端口，固定 7001，并存期由部署侧做端口映射区分。
	Port string

	// WebhookAuthToken 对应 WEBHOOK_AUTH_TOKEN，用于 /webhook/* 的 query token 校验。
	WebhookAuthToken string

	// BotToken 对应 BOT_AUTH_TOKEN，Telegram Bot API 凭据。
	BotToken string

	// ChannelInfo 对应 TELEGRAM_CHANNEL_INFO，madrid/info 接口推送目标。
	ChannelInfo string

	// ChannelIdea 对应 TELEGRAM_CHANNEL_IDEA，idea 接口推送目标。
	ChannelIdea string
}

// Load 从环境变量装配配置。缺省端口为 7001。
//
// 若当前工作目录存在 .env 文件则先加载（仅补充尚未设置的变量，
// 不覆盖已存在的真实环境变量），便于本地开发；生产环境无 .env 时无副作用。
func Load() *Config {
	// godotenv.Load 默认不覆盖已设置的环境变量；文件不存在时返回错误，忽略即可。
	_ = godotenv.Load()

	return &Config{
		Port:             getEnv("PORT", "7001"),
		WebhookAuthToken: os.Getenv("WEBHOOK_AUTH_TOKEN"),
		BotToken:         os.Getenv("BOT_AUTH_TOKEN"),
		ChannelInfo:      os.Getenv("TELEGRAM_CHANNEL_INFO"),
		ChannelIdea:      os.Getenv("TELEGRAM_CHANNEL_IDEA"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
