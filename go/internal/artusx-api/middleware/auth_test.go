package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestCheckAuthToken(t *testing.T) {
	const expected = "secret"

	cases := []struct {
		name     string
		expected string
		query    string
		wantCode int
	}{
		{"token 匹配放行", expected, "?token=secret", http.StatusOK},
		{"token 缺失", expected, "", http.StatusForbidden},
		{"token 为空", expected, "?token=", http.StatusForbidden},
		{"token 不匹配", expected, "?token=wrong", http.StatusForbidden},
		{"服务端未配置期望值", "", "?token=secret", http.StatusForbidden},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := echo.New()
			req := httptest.NewRequest(http.MethodPost, "/webhook/x"+tc.query, nil)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)

			mw := CheckAuthToken(tc.expected)
			handler := mw(func(c echo.Context) error {
				return c.String(http.StatusOK, "ok")
			})

			err := handler(c)

			// 放行分支：handler 直接写响应；拒绝分支：返回 *echo.HTTPError
			if tc.wantCode == http.StatusOK {
				if err != nil {
					t.Fatalf("期望放行，却返回错误: %v", err)
				}
				if rec.Code != http.StatusOK {
					t.Fatalf("期望 200，得到 %d", rec.Code)
				}
				return
			}

			he, ok := err.(*echo.HTTPError)
			if !ok {
				t.Fatalf("期望 *echo.HTTPError，得到 %T (%v)", err, err)
			}
			if he.Code != tc.wantCode {
				t.Fatalf("期望状态码 %d，得到 %d", tc.wantCode, he.Code)
			}
		})
	}
}
