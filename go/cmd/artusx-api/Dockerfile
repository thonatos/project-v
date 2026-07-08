# syntax=docker/dockerfile:1

# ---- build 阶段 ----
# 构建上下文为仓库根；Go 源码位于 go/。
FROM golang:1.26 AS build

WORKDIR /src

# 先拷贝 go.mod/go.sum 以复用依赖下载缓存层
COPY go/go.mod go/go.sum ./
RUN go mod download

# 拷贝 Go 源码并编译静态二进制（CGO 关闭，便于 distroless/scratch 运行）
COPY go/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/artusx-api ./cmd/artusx-api

# ---- 运行阶段 ----
# distroless 仅含运行所需，无 shell/包管理器，镜像小、攻击面小。
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app
COPY --from=build /out/artusx-api /app/artusx-api

EXPOSE 7001
USER nonroot:nonroot
ENTRYPOINT ["/app/artusx-api"]
