import { NavLink } from 'react-router';

import { cn } from '~/lib/utils';

export interface SidebarItem {
  slug: string;
  title: string;
}

interface DocsSidebarProps {
  items: SidebarItem[];
}

export function DocsSidebar({ items }: DocsSidebarProps) {
  return (
    <nav aria-label="文档导航" className="text-sm">
      <ul className="space-y-0.5">
        {items.map((item) => {
          const to = item.slug === 'index' ? '/docs' : `/docs/${item.slug}`;
          return (
            <li key={item.slug}>
              <NavLink
                to={to}
                end={item.slug === 'index'}
                className={({ isActive }) =>
                  cn(
                    'block rounded-md px-2 py-1.5 transition-colors',
                    isActive
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )
                }
              >
                {item.title}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
