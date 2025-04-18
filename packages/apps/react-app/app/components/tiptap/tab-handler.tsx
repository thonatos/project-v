import { Extension } from '@tiptap/core';

const TAB_CHAR = '\u0009';

export const TabHandler = Extension.create({
  name: 'tabHandler',
  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        // Sinks a list item / inserts a tab character
        editor
          .chain()
          .sinkListItem('listItem')
          .command(({ tr }) => {
            tr.insertText(TAB_CHAR);
            return true;
          })
          .run();
        // Prevent default behavior (losing focus)
        return true;
      },
    };
  },
});
