import { Link } from 'react-router';

// 标签颜色配置 - 和 docs-app 的 off-white 主题风格相符
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
