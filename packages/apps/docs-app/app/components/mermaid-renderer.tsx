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
      theme: 'base',
      themeVariables: {
        // Match docs-app code block style (dark background)
        background: '#1f2937',
        primaryColor: '#f59e0b',
        primaryTextColor: '#e5e7eb',
        primaryBorderColor: '#374151',
        secondaryColor: '#374151',
        secondaryTextColor: '#e5e7eb',
        secondaryBorderColor: '#4b5563',
        tertiaryColor: '#4b5563',
        tertiaryTextColor: '#e5e7eb',
        tertiaryBorderColor: '#6b7280',
        lineColor: '#6b7280',
        textColor: '#e5e7eb',
        mainBkg: '#1f2937',
        nodeBkg: '#374151',
        nodeBorder: '#4b5563',
        clusterBkg: '#1f2937',
        clusterBorder: '#374151',
        titleColor: '#f59e0b',
        edgeLabelBackground: '#1f2937',
        actorBkg: '#374151',
        actorBorder: '#4b5563',
        actorTextColor: '#e5e7eb',
        actorLineColor: '#6b7280',
        signalColor: '#6b7280',
        signalTextColor: '#e5e7eb',
        labelBoxBkgColor: '#374151',
        labelBoxBorderColor: '#4b5563',
        labelTextColor: '#e5e7eb',
        loopTextColor: '#e5e7eb',
        noteBorderColor: '#f59e0b',
        noteBkgColor: '#374151',
        noteTextColor: '#e5e7eb',
        classText: '#e5e7eb',
      },
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
