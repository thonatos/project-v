// 标签与分类的色彩编码（暗色主题）

export interface TagColor {
  bg: string;
  text: string;
  hover: string;
  hoverText?: string;
}

// 标签 chip 配色（暗色：半透明底 + 亮色文字）
export const TAG_COLORS: Record<string, TagColor> = {
  violet: {
    bg: 'bg-violet-500/15',
    text: 'text-violet-300',
    hover: 'hover:bg-violet-500/25',
    hoverText: 'hover:text-violet-200',
  },
  purple: {
    bg: 'bg-purple-500/15',
    text: 'text-purple-300',
    hover: 'hover:bg-purple-500/25',
    hoverText: 'hover:text-purple-200',
  },
  fuchsia: {
    bg: 'bg-fuchsia-500/15',
    text: 'text-fuchsia-300',
    hover: 'hover:bg-fuchsia-500/25',
    hoverText: 'hover:text-fuchsia-200',
  },
  indigo: {
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-300',
    hover: 'hover:bg-indigo-500/25',
    hoverText: 'hover:text-indigo-200',
  },
  cyan: {
    bg: 'bg-cyan-500/15',
    text: 'text-cyan-300',
    hover: 'hover:bg-cyan-500/25',
    hoverText: 'hover:text-cyan-200',
  },
  emerald: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-300',
    hover: 'hover:bg-emerald-500/25',
    hoverText: 'hover:text-emerald-200',
  },
};

export const COLOR_KEYS = Object.keys(TAG_COLORS);

// 稳定哈希：累加字符码取模
function hashString(s: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash + s.charCodeAt(i)) % mod;
  }
  return hash;
}

// 根据标签名称哈希分配 chip 配色
export function getTagColor(tag: string): TagColor {
  return TAG_COLORS[COLOR_KEYS[hashString(tag, COLOR_KEYS.length)]];
}

// ---- 分类色彩编码：每个分类稳定映射一个 hex 强调色 ----

export interface CategoryColor {
  /** 强调色 hex，用于左边条/圆点/渐变 */
  accent: string;
  /** 半透明色块底（rgba），用于色块矩阵 */
  soft: string;
}

const CATEGORY_PALETTE: CategoryColor[] = [
  { accent: '#8b6dff', soft: 'rgba(139, 109, 255, 0.14)' }, // violet
  { accent: '#22d3ee', soft: 'rgba(34, 211, 238, 0.14)' }, // cyan
  { accent: '#fbbf24', soft: 'rgba(251, 191, 36, 0.14)' }, // amber
  { accent: '#34d399', soft: 'rgba(52, 211, 153, 0.14)' }, // emerald
  { accent: '#fb7185', soft: 'rgba(251, 113, 133, 0.14)' }, // rose
  { accent: '#818cf8', soft: 'rgba(129, 140, 248, 0.14)' }, // indigo
];

// 根据分类名称稳定分配强调色
export function getCategoryColor(category: string): CategoryColor {
  return CATEGORY_PALETTE[hashString(category, CATEGORY_PALETTE.length)];
}
