import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';

import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import CharacterCount from '@tiptap/extension-character-count';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextStyle from '@tiptap/extension-text-style';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import Youtube from '@tiptap/extension-youtube';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Color } from '@tiptap/extension-color';
import { common, createLowlight } from 'lowlight';

import { CustomCommand } from './command';
import { EditorTopMenu } from './editor-top-menu';
import { EditorFloatMenu } from './editor-float-menu';
import { SlashSuggestion } from './slash-suggestion';

const lowlight = createLowlight(common);

export const Tiptap: React.FC<{
  content?: string;
  editable?: boolean;
  onChange?: (content: string) => void;
}> = ({ content, editable, onChange }) => {
  const [rendered, setRendered] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // options
        codeBlock: false,
      }),
      Image,
      Underline,
      TextStyle,
      Color,
      CharacterCount,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      CustomCommand.configure({
        suggestion: SlashSuggestion,
      }),
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
      CodeBlockLowlight.configure({
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
    <div className="relative border rounded-lg">
      <EditorFloatMenu editor={editor} />

      <EditorTopMenu editor={editor} />

      <EditorContent editor={editor} className="p-4" />

      <div className="text-sm text-gray-500 p-2 text-right border-t">
        {editor.storage.characterCount.words()} words
      </div>
    </div>
  );
};

export default Tiptap;
