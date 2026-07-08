// Package handler 实现 artusx-api 的 HTTP 处理器。
package handler

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"implements.io/projectv/internal/artusx-api/view"
)

// robotsContent 对齐旧 Node 版 /Robots.txt 返回内容。
const robotsContent = `
User-agent: *
Disallow: /
`

// homeData 为首页模板数据，标题与欢迎信息与旧版一致。
var homeData = map[string]any{
	"title":   "ArtusX",
	"message": "Hello ArtusX!",
}

// Home 处理 GET / ：渲染首页模板。
func Home(c echo.Context) error {
	html, err := view.Render("index.html", homeData)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return c.HTML(http.StatusOK, html)
}

// Robots 处理 GET /Robots.txt ：返回纯文本。
func Robots(c echo.Context) error {
	return c.String(http.StatusOK, robotsContent)
}
