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
        primaryColor: '#374151',
        primaryTextColor: '#f9fafb',
        primaryBorderColor: '#f59e0b',
        secondaryColor: '#4b5563',
        secondaryTextColor: '#f9fafb',
        secondaryBorderColor: '#6b7280',
        tertiaryColor: '#6b7280',
        tertiaryTextColor: '#f9fafb',
        tertiaryBorderColor: '#9ca3af',
        // Lines and edges - use bright color for visibility
        lineColor: '#9ca3af',
        // Text colors - use bright white for readability
        textColor: '#f9fafb',
        mainBkg: '#1f2937',
        nodeBkg: '#374151',
        nodeBorder: '#f59e0b',
        clusterBkg: '#1f2937',
        clusterBorder: '#374151',
        titleColor: '#f59e0b',
        // Edge/connection labels - bright background and text
        edgeLabelBackground: '#374151',
        labelTextColor: '#f9fafb',
        // Sequence diagram (works fine)
        actorBkg: '#374151',
        actorBorder: '#f59e0b',
        actorTextColor: '#f9fafb',
        actorLineColor: '#9ca3af',
        signalColor: '#9ca3af',
        signalTextColor: '#f9fafb',
        labelBoxBkgColor: '#374151',
        labelBoxBorderColor: '#f59e0b',
        loopTextColor: '#f9fafb',
        noteBorderColor: '#f59e0b',
        noteBkgColor: '#374151',
        noteTextColor: '#f9fafb',
        // Class diagram - ensure text visibility
        classText: '#f9fafb',
      },
      flowchart: {
        curve: 'basis',
        padding: 15,
      },
      sequence: {
        diagramMarginX: 50,
        diagramMarginY: 10,
        actorMargin: 50,
        width: 150,
        height: 65,
        boxMargin: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 35,
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
