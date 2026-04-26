import { useEffect } from 'react';
import mermaid from 'mermaid';

/**
 * MermaidRenderer - Finds and renders all mermaid code blocks in the document
 * Uses mermaid.run() which is the recommended API for mermaid v10+
 */
export function MermaidRenderer() {
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
    });

    // mermaid.run() will find all elements with class="mermaid" and render them
    mermaid.run({
      querySelector: 'pre.mermaid',
      suppressErrors: false,
    });
  }, []);

  return null;
}
