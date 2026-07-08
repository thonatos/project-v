// Package view 内嵌并预编译 HTML 模板。
//
// 模板文件通过 go:embed 打进二进制，服务启动时一次性解析，
// 便于以 distroless/scratch 作为运行镜像（无需单独拷贝模板文件）。
package view

import (
	"bytes"
	"embed"
	"fmt"
	"html/template"
)

//go:embed index.html template/*.html
var files embed.FS

// tmpl 为预编译的模板集合。missingkey=zero 使缺失的键渲染为零值而非报错，
// 与旧 Nunjucks（autoescape、缺值渲染为空）行为对齐。
var tmpl = template.Must(
	template.New("").Option("missingkey=zero").ParseFS(files, "index.html", "template/*.html"),
)

// Render 按模板名渲染 data 并返回结果字符串。
//
// name 取模板文件基名，如 "index.html"、"madrid.html"、"info.html"。
func Render(name string, data any) (string, error) {
	var buf bytes.Buffer
	if err := tmpl.ExecuteTemplate(&buf, name, data); err != nil {
		return "", fmt.Errorf("render template %q: %w", name, err)
	}
	return buf.String(), nil
}
