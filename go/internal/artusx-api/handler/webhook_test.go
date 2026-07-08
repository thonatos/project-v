package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"

	"implements.io/projectv/internal/artusx-api/config"
	"implements.io/projectv/internal/artusx-api/telegram"
)

func newTestWebhook() *Webhook {
	cfg := &config.Config{ChannelInfo: "@info", ChannelIdea: "@idea"}
	// bot token 为空：SendMessage 必失败，用于验证「失败仍返回 done」。
	return NewWebhook(cfg, telegram.New(""))
}

func doPost(t *testing.T, h echo.HandlerFunc, body string) *httptest.ResponseRecorder {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/webhook/x", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	if err := h(c); err != nil {
		t.Fatalf("handler 返回错误: %v", err)
	}
	return rec
}

func TestMadridReturnsDoneOnPushFailure(t *testing.T) {
	wh := newTestWebhook()
	rec := doPost(t, wh.Madrid, `{"title":"t","data":{"name":"BTC"}}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("期望 200，得到 %d", rec.Code)
	}
	if rec.Body.String() != "done" {
		t.Fatalf("期望 done，得到 %q", rec.Body.String())
	}
}

func TestInfoReturnsDone(t *testing.T) {
	wh := newTestWebhook()
	rec := doPost(t, wh.Info, `{"info":"i","pair":"p"}`)
	if rec.Body.String() != "done" {
		t.Fatalf("期望 done，得到 %q", rec.Body.String())
	}
}

func TestIdeaEmptyMessageReturnsDone(t *testing.T) {
	wh := newTestWebhook()
	rec := doPost(t, wh.Idea, `{"message":""}`)
	if rec.Body.String() != "done" {
		t.Fatalf("期望 done，得到 %q", rec.Body.String())
	}
}

func TestIdeaWithMessageReturnsDone(t *testing.T) {
	wh := newTestWebhook()
	rec := doPost(t, wh.Idea, `{"message":"hello"}`)
	if rec.Body.String() != "done" {
		t.Fatalf("期望 done，得到 %q", rec.Body.String())
	}
}

func TestHomeAndAPIRender(t *testing.T) {
	for _, h := range []echo.HandlerFunc{Home, API} {
		e := echo.New()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)
		if err := h(c); err != nil {
			t.Fatalf("handler 返回错误: %v", err)
		}
		if rec.Code != http.StatusOK {
			t.Fatalf("期望 200，得到 %d", rec.Code)
		}
		if !strings.Contains(rec.Body.String(), "ArtusX") {
			t.Errorf("渲染输出应含 ArtusX")
		}
	}
}

func TestRobots(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/Robots.txt", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	if err := Robots(c); err != nil {
		t.Fatalf("handler 返回错误: %v", err)
	}
	if !strings.Contains(rec.Body.String(), "Disallow: /") {
		t.Errorf("robots 输出不符: %s", rec.Body.String())
	}
}
