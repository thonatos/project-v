import React, { useState } from 'react';
import { BubbleMenu } from '@tiptap/react';
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
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';

import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Toggle } from '~/components/ui/toggle';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { Separator } from '~/components/ui/separator';

import type { Editor } from '@tiptap/core';

export const EditorMenu: React.FC<{ editor: Editor }> = ({ editor }) => {
  return (
    <>
      {/* type */}
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

      <Separator orientation="vertical" style={{ height: '20px' }} />

      {/* style */}
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

      <Separator orientation="vertical" style={{ height: '20px' }} />

      <Toggle
        size="sm"
        pressed={editor.isActive({ textAlign: 'left' })}
        onPressedChange={() => editor.chain().focus().setTextAlign('left').run()}
      >
        <AlignLeft className="w-4 h-4" />
      </Toggle>

      <Toggle
        size="sm"
        pressed={editor.isActive({ textAlign: 'center' })}
        onPressedChange={() => editor.chain().focus().setTextAlign('center').run()}
      >
        <AlignCenter className="w-4 h-4" />
      </Toggle>

      <Toggle
        size="sm"
        pressed={editor.isActive({ textAlign: 'right' })}
        onPressedChange={() => editor.chain().focus().setTextAlign('right').run()}
      >
        <AlignRight className="w-4 h-4" />
      </Toggle>

      <Separator orientation="vertical" style={{ height: '20px' }} />

      {/* func */}
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
    </>
  );
};

export const EditorFloatMenu: React.FC<{ editor: Editor }> = ({ editor }) => {
  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100, maxWidth: 500 }}
      className="flex items-center gap-1 p-1 bg-white border rounded-lg shadow-lg dark:bg-gray-800"
    >
      <EditorMenu editor={editor} />
    </BubbleMenu>
  );
};

export const EditorTopMenu: React.FC<{ editor: Editor }> = ({ editor }) => {
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');

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

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b">
      <EditorMenu editor={editor} />

      <Separator orientation="vertical" style={{ height: '20px' }} />

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
                className="w-6 h-6 rounded-md focus:outline-none focus:ring-1 focus:ring-offset-0"
                style={{ backgroundColor: color }}
                onClick={() => editor.chain().focus().setColor(color).run()}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
