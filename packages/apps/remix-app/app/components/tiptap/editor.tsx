import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';

import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import CharacterCount from '@tiptap/extension-character-count';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextStyle from '@tiptap/extension-text-style';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Color } from '@tiptap/extension-color';
import { common, createLowlight } from 'lowlight';

import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link2,
  Image as ImageIcon,
  Code,
  Quote,
  ListOrdered,
  List,
  Heading1,
  Heading2,
  Heading3,
  Palette,
} from 'lucide-react';

import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Toggle } from '~/components/ui/toggle';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';

import { CustomCommand } from './command';
import { slashSuggestion } from './slash-suggestion';

const lowlight = createLowlight(common);

export const Tiptap: React.FC<{
  content?: string;
  editable?: boolean;
  onChange?: (content: string) => void;
}> = ({ content, editable, onChange }) => {
  const [rendered, setRendered] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // options
      }),
      CustomCommand.configure({
        suggestion: slashSuggestion,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      Image,
      TextStyle,
      Color,
      Placeholder.configure({
        placeholder: 'Write something …',
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      CharacterCount,
    ],
    content,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-slate prose-sm sm:prose-base max-w-none focus:outline-none',
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

  const addLink = () => {
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
      setLinkUrl('');
    }
  };

  const addImage = () => {
    if (imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl('');
    }
  };

  if (!editable) {
    return <EditorContent editor={editor} className="pt-4" />;
  }

  return (
    <div className="relative border rounded-lg">
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

      <div className="flex flex-wrap items-center gap-1 p-2 border-b">
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

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="px-2">
              <Link2 className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="flex space-x-2">
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="输入链接地址..."
              />
              <Button onClick={addLink}>添加</Button>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="px-2">
              <ImageIcon className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="flex space-x-2">
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="输入图片地址..."
              />
              <Button onClick={addImage}>添加</Button>
            </div>
          </PopoverContent>
        </Popover>

        <Toggle
          size="sm"
          pressed={editor.isActive('code')}
          onPressedChange={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="w-4 h-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive('blockquote')}
          onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="w-4 h-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive('bulletList')}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="w-4 h-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive('orderedList')}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="w-4 h-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive('heading', { level: 1 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="w-4 h-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive('heading', { level: 2 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="w-4 h-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive('heading', { level: 3 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="w-4 h-4" />
        </Toggle>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="px-2">
              <Palette className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40">
            <div className="grid grid-cols-5 gap-1">
              {['#000000', '#ef4444', '#22c55e', '#3b82f6', '#a855f7'].map((color) => (
                <button
                  key={color}
                  className="w-6 h-6 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2"
                  style={{ backgroundColor: color }}
                  onClick={() => editor.chain().focus().setColor(color).run()}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <EditorContent editor={editor} className="p-4" />

      <div className="text-sm text-gray-500 p-2 text-right border-t">
        {editor.storage.characterCount.words()} words
      </div>
    </div>
  );
};

export default Tiptap;
