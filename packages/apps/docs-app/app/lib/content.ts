export type BlogCategory = 'engineering' | 'markets';

export const BLOG_CATEGORIES: ReadonlyArray<{ value: BlogCategory; label: string }> = [
  { value: 'engineering', label: '技术与工程' },
  { value: 'markets', label: '股票与市场' },
];

export function getBlogCategoryLabel(category: string): string {
  return BLOG_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}
