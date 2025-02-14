import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';

export const CustomCommand = Extension.create({
  name: 'commands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: any) => {
          console.log('commands.command', props, range);
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
