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
      theme: 'default',
      securityLevel: 'loose',
    });

    mermaid.run({
      querySelector: 'pre.mermaid',
      suppressErrors: false,
    });
  }, []);

  return null;
}
