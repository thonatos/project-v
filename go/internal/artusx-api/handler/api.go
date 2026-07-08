package handler

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"implements.io/projectv/internal/artusx-api/view"
)

// API 处理 GET /api ：渲染首页模板。
//
// 注意：GET /api/strategies 已随 ClickHouse 一并移除，不在此实现，
// 未注册的路径由 echo 默认返回 404。
func API(c echo.Context) error {
	html, err := view.Render("index.html", homeData)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.HTML(http.StatusOK, html)
}
