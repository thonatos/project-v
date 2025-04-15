import { Extension } from '@tiptap/core';
import { Suggestion } from '@tiptap/suggestion';

export const CustomCommand = Extension.create({
  name: 'custom_commands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: any) => {
          editor.chain().focus().deleteRange(range).run();
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
