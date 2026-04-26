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
        // Background layers - dark gray tones
        background: '#1f2937',
        mainBkg: '#1f2937',
        nodeBkg: '#374151',
        clusterBkg: '#1f2937',
        edgeLabelBackground: '#374151',

        // Text colors - high contrast (near white)
        textColor: '#f9fafb',
        primaryTextColor: '#f9fafb',
        secondaryTextColor: '#f9fafb',
        tertiaryTextColor: '#f9fafb',
        classText: '#f9fafb',
        labelTextColor: '#f9fafb',

        // Borders and lines - medium gray (visible, not harsh)
        lineColor: '#9ca3af',
        primaryBorderColor: '#6b7280',
        secondaryBorderColor: '#6b7280',
        tertiaryBorderColor: '#6b7280',
        nodeBorder: '#6b7280',
        clusterBorder: '#374151',

        // Node colors
        primaryColor: '#374151',
        secondaryColor: '#4b5563',
        tertiaryColor: '#6b7280',

        // Sequence diagram
        actorBkg: '#374151',
        actorBorder: '#6b7280',
        actorTextColor: '#f9fafb',
        actorLineColor: '#9ca3af',
        signalColor: '#9ca3af',
        signalTextColor: '#f9fafb',
        labelBoxBkgColor: '#374151',
        labelBoxBorderColor: '#6b7280',
        loopTextColor: '#f9fafb',
        noteBorderColor: '#6b7280',
        noteBkgColor: '#374151',
        noteTextColor: '#f9fafb',
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

    mermaid.run({
      querySelector: 'pre.mermaid',
      suppressErrors: false,
    });
  }, []);

  return null;
}
