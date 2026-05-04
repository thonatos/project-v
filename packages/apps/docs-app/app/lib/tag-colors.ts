// 紫色系标签颜色配置 - hover 更深
export const TAG_COLORS: Record<string, { bg: string; text: string; hover: string; hoverText?: string }> = {
  violet: {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    hover: 'hover:bg-violet-200',
    hoverText: 'hover:text-violet-900',
  },
  purple: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    hover: 'hover:bg-purple-200',
    hoverText: 'hover:text-purple-900',
  },
  fuchsia: {
    bg: 'bg-fuchsia-50',
    text: 'text-fuchsia-700',
    hover: 'hover:bg-fuchsia-200',
    hoverText: 'hover:text-fuchsia-900',
  },
  indigo: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    hover: 'hover:bg-indigo-200',
    hoverText: 'hover:text-indigo-900',
  },
  lavender: {
    bg: 'bg-violet-100',
    text: 'text-violet-800',
    hover: 'hover:bg-violet-300',
    hoverText: 'hover:text-violet-900',
  },
  plum: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    hover: 'hover:bg-purple-300',
    hoverText: 'hover:text-purple-900',
  },
};

export const COLOR_KEYS = Object.keys(TAG_COLORS);

// 根据标签名称哈希分配颜色
export function getTagColor(tag: string): { bg: string; text: string; hover: string; hoverText?: string } {
  // 简单哈希：累加字符码并取模
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash + tag.charCodeAt(i)) % COLOR_KEYS.length;
  }
  const colorKey = COLOR_KEYS[hash];
  return TAG_COLORS[colorKey];
}
