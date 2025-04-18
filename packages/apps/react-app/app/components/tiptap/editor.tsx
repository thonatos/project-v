import React, { useState, useEffect } from 'react';
import { all, createLowlight } from 'lowlight';
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';

import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import StarterKit from '@tiptap/starter-kit';
import Youtube from '@tiptap/extension-youtube';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';

import { UniqueID } from '@tiptap-pro/extension-unique-id';
import { Color } from '@tiptap/extension-color';
import {
  getHierarchicalIndexes,
  TableOfContents,
  type TableOfContentData,
} from '@tiptap-pro/extension-table-of-contents';

import css from 'highlight.js/lib/languages/css';
import html from 'highlight.js/lib/languages/xml';
import js from 'highlight.js/lib/languages/javascript';
import ts from 'highlight.js/lib/languages/typescript';

// import { EditorTopMenu } from './editor-top-menu';
import { EditorTopMenu, EditorFloatMenu } from './editor-menu';
// import { CustomCommand } from './command';
// import { SlashSuggestion } from './slash-suggestion';
import { TabHandler } from './tab-handler';
import { CodeBlockComponent } from './code-block-component';

const lowlight = createLowlight(all);
// you can also register individual languages
lowlight.register('js', js);
lowlight.register('ts', ts);
lowlight.register('css', css);
lowlight.register('html', html);

import { ToC } from './editor-toc';

export const Tiptap: React.FC<{
  content?: string;
  editable?: boolean;
  onChange?: (content: string) => void;
}> = ({ content, editable, onChange }) => {
  const [items, setItems] = useState<TableOfContentData>([]);
  const [rendered, setRendered] = useState(false);
  const MemorizedToC = React.memo(ToC);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // options
        codeBlock: false,
      }),
      UniqueID.configure({
        types: ['heading', 'paragraph'],
      }),
      TableOfContents.configure({
        getIndex: getHierarchicalIndexes,
        onUpdate(content) {
          setItems(content);
        },
      }),
      Image,
      Underline,
      TextStyle,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Color,
      CharacterCount,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      // CustomCommand.configure({
      //   suggestion: SlashSuggestion,
      // }),
      TabHandler,
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: 'Write something …',
      }),
      Youtube.configure({
        controls: false,
        nocookie: true,
      }),
      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockComponent);
        },
      }).configure({
        lowlight,
      }),
    ],
    content,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose prose-slate prose-sm sm:prose-base max-w-none min-h-[400px] focus:outline-none dark:prose-invert',
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!content || !editor || rendered) {
      return;
    }
    editor.commands.setContent(content, true);
    setRendered(true);
  }, [content, editor, rendered]);

  if (!editor) return null;

  if (!editable) {
    return <EditorContent editor={editor} />;
  }

  return (
    <div className="flex flex-row gap-4">
      {/* toc */}
      <div className="tiptap-toc border rounded-lg p-4 w-[240px]">
        <div className="text-sm text-gray-500 mb-2">Table of Contents</div>
        <MemorizedToC editor={editor} items={items} />
      </div>

      {/* editor */}
      <div className="relative border rounded-lg flex-1">
        <EditorFloatMenu editor={editor} />

        <EditorTopMenu editor={editor} />

        <EditorContent editor={editor} className="p-4" />

        <div className="text-sm text-gray-500 p-2 text-right border-t">
          {editor.storage.characterCount.words()} words
        </div>
      </div>
    </div>
  );
};

export default Tiptap;
