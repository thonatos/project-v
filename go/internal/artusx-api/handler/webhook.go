package handler

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"implements.io/projectv/internal/artusx-api/config"
	"implements.io/projectv/internal/artusx-api/telegram"
	"implements.io/projectv/internal/artusx-api/view"
)

// Webhook 承载 /webhook/* 处理器所需依赖（手动注入）。
type Webhook struct {
	cfg *config.Config
	bot *telegram.Bot
}

// NewWebhook 构造 Webhook 处理器。
func NewWebhook(cfg *config.Config, bot *telegram.Bot) *Webhook {
	return &Webhook{cfg: cfg, bot: bot}
}

// Madrid 处理 POST /webhook/madrid ：渲染 madrid 模板后推送到 info channel。
func (h *Webhook) Madrid(c echo.Context) error {
	return h.renderAndSend(c, "madrid.html", h.cfg.ChannelInfo)
}

// Info 处理 POST /webhook/info ：渲染 info 模板后推送到 info channel。
func (h *Webhook) Info(c echo.Context) error {
	return h.renderAndSend(c, "info.html", h.cfg.ChannelInfo)
}

// renderAndSend 解析请求体为 map，渲染指定模板并推送到 channel。
// 与旧 Node 版一致：推送失败仅记日志，接口仍返回 "done"。
func (h *Webhook) renderAndSend(c echo.Context, tmpl, channel string) error {
	var body map[string]any
	if err := c.Bind(&body); err != nil {
		c.Logger().Errorf("webhook %s: 解析请求体失败: %v", tmpl, err)
		return c.String(http.StatusOK, "done")
	}

	message, err := view.Render(tmpl, body)
	if err != nil {
		c.Logger().Errorf("webhook %s: 渲染模板失败: %v", tmpl, err)
		return c.String(http.StatusOK, "done")
	}

	if err := h.bot.SendMessage(c.Request().Context(), channel, message); err != nil {
		c.Logger().Errorf("webhook %s: 推送失败: %v", tmpl, err)
	}
	return c.String(http.StatusOK, "done")
}

// Idea 处理 POST /webhook/idea ：将 body.message 直接推送到 idea channel。
// message 为空时不推送，但仍返回 "done"。
func (h *Webhook) Idea(c echo.Context) error {
	var body struct {
		Message string `json:"message"`
	}
	if err := c.Bind(&body); err != nil {
		c.Logger().Errorf("webhook idea: 解析请求体失败: %v", err)
		return c.String(http.StatusOK, "done")
	}

	if body.Message != "" {
		if err := h.bot.SendMessage(c.Request().Context(), h.cfg.ChannelIdea, body.Message); err != nil {
			c.Logger().Errorf("webhook idea: 推送失败: %v", err)
		}
	}
	return c.String(http.StatusOK, "done")
}
