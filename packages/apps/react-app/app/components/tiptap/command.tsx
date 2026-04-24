import { Extension } from '@tiptap/core';
import { Suggestion } from '@tiptap/suggestion';

interface CommandProps {
  editor: { chain: () => { focus: () => { deleteRange: (range: unknown) => { run: () => void } } } };
  range: unknown;
  props: unknown;
}

export const CustomCommand = Extension.create({
  name: 'custom_commands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range }: CommandProps) => {
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
