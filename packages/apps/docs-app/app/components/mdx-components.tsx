import { useMDXComponents as getMDXComponents } from '@mdx-js/react';
import { CodeBlock } from '~/components/code-block';
import { MermaidDiagram } from '~/components/mermaid-diagram';
import { ProseImage } from '~/components/prose-image';

interface CodeElementProps {
  className?: string;
  children: string;
}

export function useMDXComponents(components: Record<string, React.ComponentType> = {}) {
  return getMDXComponents({
    // Wrapper for article content - Tailwind Blog style
    wrapper: ({ children }) => (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <article className="prose">{children}</article>
      </div>
    ),
    pre: ({ children, ...props }) => {
      // Check if children is a code element with mermaid class
      if (typeof children === 'object' && children !== null && 'props' in children) {
        const codeProps = (children as { props: CodeElementProps }).props;
        if (codeProps?.className?.includes('language-mermaid')) {
          const mermaidCode = typeof codeProps.children === 'string' ? codeProps.children : '';
          return <MermaidDiagram code={mermaidCode} />;
        }
      }
      return <CodeBlock {...props}>{children}</CodeBlock>;
    },
    img: ProseImage,
    // Remove anchor links for headings - simpler style
    h2: ({ children, ...props }) => <h2 {...props}>{children}</h2>,
    h3: ({ children, ...props }) => <h3 {...props}>{children}</h3>,
    hr: () => <hr className="border-t border-[var(--color-border)]" />,
    ...components,
  });
}
