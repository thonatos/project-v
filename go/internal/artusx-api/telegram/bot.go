// Package telegram 通过 Telegram Bot API 发送消息。
//
// 仅实现 webhook 所需的纯文本 HTML 消息推送（无图片附件），
// 使用标准库 net/http 直接调用 Bot API，不引入第三方依赖。
package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// defaultBaseURL 为 Telegram Bot API 根地址，可在测试中通过 SetBaseURL 覆盖。
const defaultBaseURL = "https://api.telegram.org"

// Bot 封装一个 Telegram Bot API 客户端。
type Bot struct {
	token   string
	baseURL string
	client  *http.Client
}

// New 用给定 bot token 构造客户端。
func New(token string) *Bot {
	return &Bot{
		token:   token,
		baseURL: defaultBaseURL,
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

// SetBaseURL 覆盖 Bot API 根地址（供测试注入 mock server 使用）。
func (b *Bot) SetBaseURL(url string) {
	b.baseURL = url
}

// SendMessage 以 parse_mode=HTML 向 chatID 推送纯文本消息。
//
// chatID 可为数字 id 或 @channelusername 形式。
func (b *Bot) SendMessage(ctx context.Context, chatID, htmlText string) error {
	if b.token == "" {
		return fmt.Errorf("telegram: bot token 未配置")
	}

	endpoint := fmt.Sprintf("%s/bot%s/sendMessage", b.baseURL, b.token)
	payload := map[string]any{
		"chat_id":    chatID,
		"text":       htmlText,
		"parse_mode": "HTML",
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("telegram: 序列化请求失败: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("telegram: 构造请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := b.client.Do(req)
	if err != nil {
		return fmt.Errorf("telegram: 请求失败: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		var apiErr struct {
			Description string `json:"description"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&apiErr)
		return fmt.Errorf("telegram: Bot API 返回 %d: %s", resp.StatusCode, apiErr.Description)
	}

	return nil
}
