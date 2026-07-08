package main

import (
	"net/http"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"

	"implements.io/projectv/internal/artusx-api/config"
	"implements.io/projectv/internal/artusx-api/handler"
	"implements.io/projectv/internal/artusx-api/middleware"
	"implements.io/projectv/internal/artusx-api/telegram"
)

func main() {
	cfg := config.Load()
	bot := telegram.New(cfg.BotToken)

	e := echo.New()

	// CORS：修正旧 Node 版 origin:* + credentials:true 的非法组合。
	// 采用不携带凭证的通配来源，浏览器端可正常工作（见 design 决策 6）。
	e.Use(echomw.CORSWithConfig(echomw.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{
			http.MethodGet, http.MethodHead, http.MethodPut,
			http.MethodPost, http.MethodDelete, http.MethodPatch,
		},
	}))

	// 只读路由。
	e.GET("/", handler.Home)
	e.GET("/Robots.txt", handler.Robots)
	e.GET("/api", handler.API)

	// Webhook 路由组：统一挂 token 鉴权中间件。
	wh := handler.NewWebhook(cfg, bot)
	webhook := e.Group("/webhook", middleware.CheckAuthToken(cfg.WebhookAuthToken))
	webhook.POST("/madrid", wh.Madrid)
	webhook.POST("/info", wh.Info)
	webhook.POST("/idea", wh.Idea)

	e.Logger.Fatal(e.Start(":" + cfg.Port))
}
