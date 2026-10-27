# react-app

全栈 React 应用，基于 React Router 7 与 Vite+。

## 开发

```bash
pnpm -F react-app dev
pnpm -F react-app build
pnpm -F react-app start
pnpm -F react-app typecheck
```

当前没有部署配置：`deploy` 脚本等同构建，不发布到任何目标。

## 约定

- 状态用 Jotai，通知用 Sonner，UI 用 shadcn/ui。
- 编码约定见 [`docs/7-conventions.md`](../../../docs/7-conventions.md)。
