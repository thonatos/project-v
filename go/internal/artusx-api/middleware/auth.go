// Package middleware 提供 echo 中间件。
package middleware

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

// CheckAuthToken 校验 query 参数 token 是否等于期望值。
//
// 对齐旧 Node 版 auth.middleware 行为：token 缺失、为空、
// 或服务端未配置期望值（expected 为空）、或不匹配，一律返回 403。
func CheckAuthToken(expected string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			token := c.QueryParam("token")
			if token == "" || expected == "" || token != expected {
				return echo.NewHTTPError(http.StatusForbidden, "invalid token")
			}
			return next(c)
		}
	}
}
