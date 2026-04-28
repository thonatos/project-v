## 1. 探索与准备

- [x] 1.1 定位 react-app 导航栏组件文件路径和当前结构
- [x] 1.2 定位 react-app Footer 组件文件路径和当前结构
- [x] 1.3 确认 Home 链接目标 URL 和 GitHub 仓库 URL
- [x] 1.4 确认 Lucide React 图标库已安装（Home、GitHub 图标）
- [x] 1.5 搜索项目中所有使用 slate 色系的文件（`grep -r "slate-" packages/apps/react-app/`）
- [x] 1.6 定位 Tailwind CSS 配置文件和 shadcn/ui CSS 变量定义位置

## 2. 导航栏外部链接实现

- [x] 2.1 在导航栏组件中添加 Home 外部链接（文字+Lucide Home 图标）
- [x] 2.2 在导航栏组件中添加 GitHub 外部链接（仅 Lucide GitHub 图标，无文字）
- [x] 2.3 为外部链接添加安全属性（`target="_blank"`, `rel="noopener noreferrer"`）
- [x] 2.4 为外部链接添加 aria-label 属性（如 "访问首页"、"访问 GitHub 仓库"）
- [x] 2.5 使用 Tailwind CSS 调整链接样式，确保与内部链接视觉一致

## 3. Footer 品牌标识实现

- [x] 3.1 在 Footer 组件中添加项目描述 "undefined project."
- [x] 3.2 在 Footer 组件中添加 "Powered By React Router" 文字
- [x] 3.3 将 "React Router" 文字部分设置为链接，指向 https://reactrouter.com/
- [x] 3.4 为品牌链接添加安全属性（`target="_blank"`, `rel="noopener noreferrer"`）
- [x] 3.5 使用 Tailwind CSS 设置品牌标识样式（字体、颜色、间距与 Footer 一致）
- [x] 3.6 为品牌链接添加悬停效果样式

## 4. 主题风格变更

- [x] 4.1 将 Tailwind CSS 配置中的 slate 色系替换为 neutral 色系
- [x] 4.2 更新 shadcn/ui CSS 变量（`--primary`, `--secondary`, `--background` 等）为 neutral 色值
- [x] 4.3 批量替换组件文件中的 `slate-*` 类名为 `neutral-*`
- [x] 4.4 验证主题变更后所有组件视觉效果保持一致

## 5. 验证与测试

- [ ] 5.1 在浏览器中验证导航栏 Home 和 GitHub 链接正确显示且可点击跳转
- [ ] 5.2 在浏览器中验证 Footer 项目描述 "undefined project." 正确显示
- [ ] 5.3 在浏览器中验证 Footer 品牌标识正确显示且链接可点击跳转
- [ ] 5.4 在浏览器中验证主题风格变更后整体视觉效果协调
- [ ] 5.5 使用键盘导航验证所有新增链接可通过 Tab/Enter 操作
- [x] 5.6 运行 `pnpm lint` 确保代码符合 Oxlint 规范
- [x] 5.7 运行 `pnpm -F docs-app build` 确保构建成功