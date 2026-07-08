package telegram

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSendMessageNoToken(t *testing.T) {
	b := New("")
	err := b.SendMessage(context.Background(), "@chan", "hi")
	if err == nil {
		t.Fatal("token 未配置时应返回错误")
	}
	if !strings.Contains(err.Error(), "token 未配置") {
		t.Errorf("错误信息不符: %v", err)
	}
}

func TestSendMessageSuccess(t *testing.T) {
	var gotPayload map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/sendMessage") {
			t.Errorf("非预期路径: %s", r.URL.Path)
		}
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &gotPayload)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer srv.Close()

	b := New("test-token")
	b.SetBaseURL(srv.URL)

	if err := b.SendMessage(context.Background(), "@info", "<b>hi</b>"); err != nil {
		t.Fatalf("发送应成功: %v", err)
	}
	if gotPayload["chat_id"] != "@info" {
		t.Errorf("chat_id 不符: %v", gotPayload["chat_id"])
	}
	if gotPayload["text"] != "<b>hi</b>" {
		t.Errorf("text 不符: %v", gotPayload["text"])
	}
	if gotPayload["parse_mode"] != "HTML" {
		t.Errorf("parse_mode 应为 HTML: %v", gotPayload["parse_mode"])
	}
}

func TestSendMessageAPIError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"ok":false,"description":"chat not found"}`))
	}))
	defer srv.Close()

	b := New("test-token")
	b.SetBaseURL(srv.URL)

	err := b.SendMessage(context.Background(), "@bad", "hi")
	if err == nil {
		t.Fatal("API 返回非 200 时应返回错误")
	}
	if !strings.Contains(err.Error(), "chat not found") {
		t.Errorf("错误应含 API description: %v", err)
	}
}
