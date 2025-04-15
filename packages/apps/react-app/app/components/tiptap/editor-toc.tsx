import { cn } from '~/lib/utils';
import { TextSelection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/core';
import type { TableOfContentData } from '@tiptap-pro/extension-table-of-contents';

export const ToCItem = ({ item, onItemClick }: any) => {
  return (
    <div
      className={cn('tiptap-toc-item', {
        'is-active': item.isActive && !item.isScrolledOver,
        'is-scrolled-over': item.isScrolledOver,
      })}
      style={{
        // @ts-ignore
        '--level': item.level,
      }}
    >
      <a href={`#${item.id}`} onClick={(e) => onItemClick(e, item.id)} data-item-index={item.itemIndex}>
        {item.textContent}
      </a>
    </div>
  );
};

export const ToCEmptyState = () => {
  return (
    <div className="tiptap-toc-item empty-state">
      <p>Start editing your document to see the outline.</p>
    </div>
  );
};

export const ToC = ({ items = [], editor }: { items: TableOfContentData; editor: Editor | null }) => {
  if (items.length === 0) {
    return <ToCEmptyState />;
  }

  const onItemClick = (e: Event, id: string) => {
    e.preventDefault();

    if (editor) {
      const element = editor.view.dom.querySelector(`[data-toc-id="${id}"`);

      if (!element) {
        console.error(`Element with id ${id} not found`);
        return;
      }

      const pos = editor.view.posAtDOM(element, 0);

      // set focus
      const tr = editor.view.state.tr;

      tr.setSelection(new TextSelection(tr.doc.resolve(pos)));

      editor.view.dispatch(tr);

      editor.view.focus();

      if (history.pushState) {
        // @ts-ignore
        history.pushState(null, null, `#${id}`);
      }

      window.scrollTo({
        top: element.getBoundingClientRect().top + window.scrollY,
        behavior: 'smooth',
      });
    }
  };

  return (
    <>
      {items.map((item, i) => (
        <ToCItem onItemClick={onItemClick} key={item.id} item={item} index={i + 1} />
      ))}
    </>
  );
};
