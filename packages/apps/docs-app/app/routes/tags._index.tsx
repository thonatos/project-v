import type { Route } from './+types/tags._index';
import { Link } from 'react-router';
import { getAllTags } from '~/lib/docs';

// 标签颜色配置 - 暖色中性色调，与 TagBadge 保持一致
const TAG_COLORS: Record<string, { bg: string; text: string; hover: string }> = {
  stone: {
    bg: 'bg-stone-100',
    text: 'text-stone-700',
    hover: 'hover:bg-stone-200',
  },
  warm: {
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    hover: 'hover:bg-amber-100',
  },
  tan: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-800',
    hover: 'hover:bg-yellow-100',
  },
  sand: {
    bg: 'bg-neutral-100',
    text: 'text-neutral-700',
    hover: 'hover:bg-neutral-200',
  },
  dusk: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    hover: 'hover:bg-gray-200',
  },
  earth: {
    bg: 'bg-stone-50',
    text: 'text-stone-800',
    hover: 'hover:bg-stone-150',
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
