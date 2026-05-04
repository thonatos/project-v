import type { Route } from './+types/tags._index';
import { Link } from 'react-router';
import { getAllTags } from '~/lib/docs';

// 标签颜色配置 - 和 TagBadge 保持一致
const TAG_COLORS: Record<string, { bg: string; text: string; hover: string }> = {
  amber: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    hover: 'hover:bg-amber-200',
  },
  cyan: {
    bg: 'bg-cyan-100',
    text: 'text-cyan-800',
    hover: 'hover:bg-cyan-200',
  },
  rose: {
    bg: 'bg-rose-100',
    text: 'text-rose-800',
    hover: 'hover:bg-rose-200',
  },
  emerald: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    hover: 'hover:bg-emerald-200',
  },
  violet: {
    bg: 'bg-violet-100',
    text: 'text-violet-800',
    hover: 'hover:bg-violet-200',
  },
  slate: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    hover: 'hover:bg-slate-200',
  },
};

const COLOR_KEYS = Object.keys(TAG_COLORS);

function getTagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash + tag.charCodeAt(i)) % COLOR_KEYS.length;
  }
  return TAG_COLORS[COLOR_KEYS[hash]];
}

export function meta() {
  return [{ title: 'ρV - 标签' }, { name: 'description', content: '所有标签列表' }];
}

export async function loader() {
  const tags = await getAllTags();
  return tags;
}

export default function TagsIndex({ loaderData }: Route.ComponentProps) {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12 lg:max-w-7xl lg:mx-auto">
      <header className="mb-16">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-[var(--color-text)]">标签</h1>
        <p className="text-lg text-[var(--color-text-muted)]">按标签浏览文档</p>
      </header>

      {loaderData.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {loaderData.map((tag) => {
            const color = getTagColor(tag.name);
            return (
              <Link
                key={tag.name}
                to={`/tags/${tag.name}`}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${color.bg} ${color.text} ${color.hover} transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-text)]`}
              >
                <span className="text-sm font-medium">{tag.name}</span>
                <span className="text-xs bg-white/50 px-2 py-0.5 rounded-full">{tag.count}</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="text-[var(--color-text-muted)] text-center py-12">暂无标签</p>
      )}
    </div>
  );
}
