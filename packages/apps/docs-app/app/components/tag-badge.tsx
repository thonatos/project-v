import { Link } from 'react-router';

// 标签颜色配置 - 暖色中性色调，与 docs-app 的 off-white 主题协调
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

// 根据标签名称哈希分配颜色
function getTagColor(tag: string): { bg: string; text: string; hover: string } {
  // 简单哈希：累加字符码并取模
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash + tag.charCodeAt(i)) % COLOR_KEYS.length;
  }
  const colorKey = COLOR_KEYS[hash];
  return TAG_COLORS[colorKey];
}

interface TagBadgeProps {
  tag: string;
}

export function TagBadge({ tag }: TagBadgeProps) {
  const color = getTagColor(tag);

  return (
    <Link
      to={`/tags/${tag}`}
      className={`inline-block px-2.5 py-1 text-xs font-medium rounded-md ${color.bg} ${color.text} ${color.hover} transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-text)]`}
    >
      {tag}
    </Link>
  );
}
