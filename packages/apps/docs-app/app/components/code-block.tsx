import { useState, useRef, useEffect } from 'react';
import { cn } from '~/lib/utils';
import { codeToHtml } from 'shiki';

interface CodeBlockProps {
  children: React.ReactNode;
  className?: string;
}

// Helper to extract code content from various children structures
function extractCodeFromChildren(children: React.ReactNode): { code: string; lang: string; filename?: string } {
  // Handle different children structures from MDX
  if (typeof children === 'string') {
    return { code: children, lang: 'text' };
  }

  // Handle code element with className
  if (typeof children === 'object' && children !== null) {
    const childProps = children as { props?: { className?: string; children?: React.ReactNode } };

    if (childProps.props) {
      const className = childProps.props.className || '';
      const langMatch = className.match(/language-(\w+)/);
      const lang = langMatch?.[1] || 'text';

      // Parse meta from className (e.g., language-tsx:app.tsx)
      const metaMatch = className.match(/language-(\w+):(.+)/);
      const filename = metaMatch?.[2];

      // Extract actual code string
      let code = '';
      const innerChildren = childProps.props.children;
      if (typeof innerChildren === 'string') {
        code = innerChildren;
      } else if (typeof innerChildren === 'object' && innerChildren !== null) {
        // Handle nested structure
        const innerProps = innerChildren as { props?: { children?: string } };
        if (innerProps.props && typeof innerProps.props.children === 'string') {
          code = innerProps.props.children;
        }
      }

      return { code, lang, filename };
    }
  }

  return { code: '', lang: 'text' };
}

export function CodeBlock({ children, className: _containerClassName }: CodeBlockProps) {
  const [html, setHtml] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  const { code, lang, filename } = extractCodeFromChildren(children);

  useEffect(() => {
    if (code) {
      codeToHtml(code, {
        lang: lang,
        theme: 'github-dark',
      }).then(setHtml);
    }
  }, [code, lang]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4">
      {filename && (
        <div className="bg-gray-800 text-gray-300 text-sm px-4 py-2 rounded-t-lg border-b border-gray-700">
          {filename}
        </div>
      )}
      <div className={cn('relative overflow-hidden', filename ? 'rounded-b-lg' : 'rounded-lg')}>
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-2 right-2 p-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="复制代码"
        >
          {copied ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-label="已复制">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-label="复制代码">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          )}
        </button>
        {html ? (
          <div
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki output is trusted - sanitized syntax highlighting HTML
            dangerouslySetInnerHTML={{ __html: html }}
            className="shiki overflow-x-auto text-sm [&_pre]:p-4 [&_pre]:bg-gray-900"
          />
        ) : (
          <pre className="p-4 bg-gray-900 overflow-x-auto">
            <code ref={codeRef}>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
