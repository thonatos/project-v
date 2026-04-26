import { useEffect } from 'react';
import mermaid from 'mermaid';

/**
 * MermaidRenderer - Finds and renders all mermaid code blocks in the document
 * This component scans the DOM for `<pre class="mermaid">` elements and renders them as diagrams
 */
export function MermaidRenderer() {
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
    });

    const renderMermaidBlocks = async () => {
      const mermaidBlocks = document.querySelectorAll('pre.mermaid');

      mermaidBlocks.forEach(async (block, index) => {
        const code = block.textContent || '';
        const id = `mermaid-${index}-${Math.random().toString(36).slice(2)}`;

        try {
          const { svg } = await mermaid.render(id, code);
          const div = document.createElement('div');
          div.className = 'mermaid-diagram my-4 overflow-x-auto';
          div.innerHTML = svg;
          block.replaceWith(div);
        } catch {
          const errorDiv = document.createElement('div');
          errorDiv.className = 'mermaid-error my-4 p-4 bg-red-50 border border-red-200 rounded-lg';
          errorDiv.innerHTML = `<p class="text-red-600">Mermaid 语法错误：请检查图表定义</p><pre class="mt-2 text-sm text-red-500 overflow-x-auto">${code}</pre>`;
          block.replaceWith(errorDiv);
        }
      });
    };

    renderMermaidBlocks();
  }, []);

  return null;
}
