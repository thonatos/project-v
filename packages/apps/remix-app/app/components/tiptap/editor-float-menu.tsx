import React from 'react';
import { BubbleMenu } from '@tiptap/react';
import { Bold, Italic, Underline as UnderlineIcon } from 'lucide-react';
import { Toggle } from '~/components/ui/toggle';

import type { Editor } from '@tiptap/core';

export const EditorFloatMenu: React.FC<{ editor: Editor }> = ({ editor }) => {
  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100 }}
      className="flex items-center gap-1 p-1 bg-white border rounded-lg shadow-lg dark:bg-gray-800"
    >
      <Toggle
        size="sm"
        pressed={editor.isActive('bold')}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="w-4 h-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('italic')}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="w-4 h-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('underline')}
        onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="w-4 h-4" />
      </Toggle>
    </BubbleMenu>
  );
};
