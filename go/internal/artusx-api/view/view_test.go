package view

import (
	"strings"
	"testing"
)

func TestRenderIndex(t *testing.T) {
	out, err := Render("index.html", map[string]any{
		"title":   "ArtusX",
		"message": "Hello ArtusX!",
	})
	if err != nil {
		t.Fatalf("渲染 index.html 失败: %v", err)
	}
	if !strings.Contains(out, "<title>ArtusX</title>") {
		t.Errorf("输出缺少标题，实际: %s", out)
	}
	if !strings.Contains(out, "Hello ArtusX!") {
		t.Errorf("输出缺少 message，实际: %s", out)
	}
}

func TestRenderMadrid(t *testing.T) {
	out, err := Render("madrid.html", map[string]any{
		"title": "标题",
		"data": map[string]any{
			"name":   "BTC",
			"info":   "some info",
			"ohlc":   "o",
			"volume": "100",
		},
	})
	if err != nil {
		t.Fatalf("渲染 madrid.html 失败: %v", err)
	}
	for _, want := range []string{"<b>标题</b>", "name: BTC", "info: some info", "volume: 100"} {
		if !strings.Contains(out, want) {
			t.Errorf("输出缺少 %q，实际: %s", want, out)
		}
	}
}

func TestRenderInfo(t *testing.T) {
	out, err := Render("info.html", map[string]any{
		"info":   "行情信息",
		"pair":   "BTC/USDT",
		"ohlc":   map[string]any{"close": "42000"},
		"volume": "999",
	})
	if err != nil {
		t.Fatalf("渲染 info.html 失败: %v", err)
	}
	for _, want := range []string{"行情信息", "BTC/USDT", "close: 42000", "volume: 999"} {
		if !strings.Contains(out, want) {
			t.Errorf("输出缺少 %q，实际: %s", want, out)
		}
	}
}

// missingkey=zero + with 保护：缺失的键/嵌套对象应渲染为空而不报错。
func TestRenderMissingKeyTolerant(t *testing.T) {
	if _, err := Render("info.html", map[string]any{"info": "only info"}); err != nil {
		t.Fatalf("info.html 缺失键不应导致渲染失败: %v", err)
	}
	if _, err := Render("madrid.html", map[string]any{"title": "only title"}); err != nil {
		t.Fatalf("madrid.html 缺失 data 不应导致渲染失败: %v", err)
	}
}

func TestRenderUnknownTemplate(t *testing.T) {
	_, err := Render("nope.html", nil)
	if err == nil {
		t.Fatal("渲染不存在的模板应返回错误")
	}
}
