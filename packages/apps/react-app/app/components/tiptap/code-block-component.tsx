import React from 'react';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';

export const CodeBlockComponent: React.FC<any> = ({ editor, node, updateAttributes, extension }) => {
  const {
    options: { editable },
  } = editor;
  const {
    attrs: { language: defaultLanguage = 'null' },
  } = node;

  const handleLanguageChange = (language: string) => {
    updateAttributes({ language });
  };

  return (
    <NodeViewWrapper
      className="code-block flex flex-col rounded-md mb-2"
      style={{
        backgroundColor: 'var(--tw-prose-pre-bg)',
      }}
    >
      <div className="flex justify-end p-2">
        <div className="bg-white dark:bg-black rounded-md">
          <Select defaultValue={defaultLanguage} onValueChange={handleLanguageChange} disabled={!editable}>
            <SelectTrigger className="w-[150px]" size="sm">
              <SelectValue placeholder="Select a language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={'null'}>auto</SelectItem>
              {extension.options.lowlight.listLanguages().map((lang: string, index: number) => (
                <SelectItem value={lang} key={index}>
                  {lang}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <pre
        style={{
          padding: '1rem',
          margin: '0',
        }}
      >
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
};

export default CodeBlockComponent;
