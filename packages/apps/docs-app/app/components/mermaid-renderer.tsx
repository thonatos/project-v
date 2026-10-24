import { useEffect } from 'react';
import { useLocation } from 'react-router';
import mermaid from 'mermaid';

/**
 * 与站点暗色 token 对齐的 Mermaid 主题。
 * Mermaid 的 default / dark 主题都偏向自己的调色板，放在深色页面上会发灰或发亮，
 * 所以用 base 主题逐项指定，保证图、正文、代码块的观感一致。
 */
const THEME_VARIABLES = {
  background: '#0a0a0f',
  primaryColor: '#1c1c26',
  primaryTextColor: '#e7e7ea',
  primaryBorderColor: '#8b6dff',
  secondaryColor: '#13131a',
  tertiaryColor: '#0a0a0f',
  titleColor: '#e7e7ea',
  textColor: '#e7e7ea',
  lineColor: '#9a9aa5',
  edgeLabelBackground: '#0a0a0f',
  clusterBkg: '#13131a',
  clusterBorder: 'rgba(255, 255, 255, 0.12)',
  fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  fontSize: '14px',
  // sequence diagram
  actorBkg: '#1c1c26',
  actorBorder: '#3a3a4a',
  actorTextColor: '#e7e7ea',
  actorLineColor: '#3a3a4a',
  signalColor: '#9a9aa5',
  signalTextColor: '#e7e7ea',
  labelBoxBkgColor: '#1c1c26',
  labelBoxBorderColor: '#8b6dff',
  labelTextColor: '#e7e7ea',
  loopTextColor: '#e7e7ea',
  noteBkgColor: '#2b2b20',
  noteTextColor: '#e7e7ea',
  noteBorderColor: '#4a4a3a',
  activationBkgColor: '#2a2540',
  activationBorderColor: '#8b6dff',
} as const;

// 必须在模块加载时完成初始化：Mermaid 自己会在 DOMContentLoaded 用默认主题
// 预渲染 pre.mermaid，等到 useEffect 再设置就只剩一个已标记 data-processed 的浅色图。
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  darkMode: true,
  securityLevel: 'loose',
  themeVariables: THEME_VARIABLES,
  flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
  sequence: { useMaxWidth: true, mirrorActors: false },
});

/**
 * MermaidRenderer - Finds and renders all mermaid code blocks in the document.
 * Re-runs on navigation because the doc page reuses the layout while its body
 * is replaced.
 */
export function MermaidRenderer() {
  const location = useLocation();

  useEffect(() => {
    void mermaid.run({ querySelector: 'pre.mermaid' }).catch((error: unknown) => {
      console.error('Failed to render mermaid diagram', error);
    });
  }, [location.pathname]);

  return null;
}
