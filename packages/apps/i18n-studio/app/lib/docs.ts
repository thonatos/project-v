import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import type { Root, Heading } from 'mdast';
import type { Element, Root as HastRoot, Text as HastText, ElementContent } from 'hast';
import { visit } from 'unist-util-visit';

const docsDir = path.join(process.cwd(), 'app/docs');

interface DocFrontmatter {
  title: string;
  description: string;
}

interface TocItem {
  id: string;
  text: string;
  depth: number;
  children: TocItem[];
}

export interface Doc {
  slug: string;
  title: string;
  description: string;
  content: string;
  toc: TocItem[];
}

/**
 * 用 gray-matter 解析 frontmatter,容忍 value 中含英文/中文冒号、引号、换行等。
 * 找不到 frontmatter 时返回 fallback。
 */
function extractFrontmatter(raw: string): { frontmatter: DocFrontmatter; body: string } {
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  return {
    frontmatter: {
      title: typeof data.title === 'string' ? data.title : 'Untitled',
      description: typeof data.description === 'string' ? data.description : '',
    },
    body: parsed.content,
  };
}

// Generate unique heading ID (supports Chinese and Unicode characters)
function generateHeadingId(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .slice(0, 100);
}

// Get text content from mdast node recursively
function getMdastTextContent(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as { type?: string; value?: string; children?: unknown[] };
  if (n.type === 'text' && typeof n.value === 'string') {
    return n.value;
  }
  if (Array.isArray(n.children)) {
    return n.children.map(getMdastTextContent).join('');
  }
  return '';
}

// Extract TOC from markdown AST (with uniqueness counter)
function extractToc(tree: Root): TocItem[] {
  const headings: TocItem[] = [];
  const stack: { depth: number; items: TocItem[] }[] = [{ depth: 0, items: headings }];
  const idCounts = new Map<string, number>();

  visit(tree, 'heading', (node: Heading) => {
    if (node.depth < 1 || node.depth > 3) return;

    const text = getMdastTextContent(node);
    const baseId = generateHeadingId(text);
    if (!baseId) return;

    const count = idCounts.get(baseId) || 0;
    idCounts.set(baseId, count + 1);

    const uniqueId = count > 0 ? `${baseId}-${count + 1}` : baseId;
    const item: TocItem = { id: uniqueId, text, depth: node.depth, children: [] };

    while (stack.length > 1 && stack[stack.length - 1].depth >= node.depth) {
      stack.pop();
    }

    stack[stack.length - 1].items.push(item);
    stack.push({ depth: node.depth, items: item.children });
  });

  return headings;
}

// Get text content from a hast element recursively
function getTextContent(node: ElementContent | HastText | Element): string {
  if (node.type === 'text') {
    return node.value;
  }
  if (node.type === 'element' && node.children) {
    return node.children.map((c) => getTextContent(c as ElementContent)).join('');
  }
  return '';
}

// Add heading IDs to hast tree (with uniqueness counter)
function addHeadingIds(tree: HastRoot): void {
  const idCounts = new Map<string, number>();

  visit(tree, 'element', (node: Element) => {
    if (['h1', 'h2', 'h3'].includes(node.tagName)) {
      const text = getTextContent(node);
      const baseId = generateHeadingId(text);
      if (!baseId) return;

      const count = idCounts.get(baseId) || 0;
      idCounts.set(baseId, count + 1);

      const uniqueId = count > 0 ? `${baseId}-${count + 1}` : baseId;
      node.properties = { ...node.properties, id: uniqueId };
    }
  });
}

// Process markdown to HTML with TOC
async function processMarkdown(body: string): Promise<{ content: string; toc: TocItem[] }> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeHighlight, { detect: true })
    .use(rehypeStringify, { allowDangerousHtml: true });

  const tree = processor.parse(body);
  const toc = extractToc(tree as Root);

  const hastTree = await processor.run(tree, body);
  addHeadingIds(hastTree as HastRoot);

  const content = processor.stringify(hastTree);

  return { content: String(content), toc };
}

export async function getDocSlugs(): Promise<string[]> {
  if (!fs.existsSync(docsDir)) {
    return [];
  }

  const files = fs.readdirSync(docsDir);
  return files
    .filter((file) => file.endsWith('.md') || file.endsWith('.markdown'))
    .map((file) => file.replace(/\.(md|markdown)$/, ''));
}

export async function getDocBySlug(slug: string): Promise<Doc | null> {
  const filePath = path.join(docsDir, `${slug}.md`);
  const altFilePath = path.join(docsDir, `${slug}.markdown`);

  const actualPath = fs.existsSync(filePath) ? filePath : fs.existsSync(altFilePath) ? altFilePath : null;

  if (!actualPath) {
    return null;
  }

  const content = fs.readFileSync(actualPath, 'utf-8');
  const { frontmatter, body } = extractFrontmatter(content);
  const { content: htmlContent, toc } = await processMarkdown(body);

  return {
    slug,
    title: frontmatter.title || slug,
    description: frontmatter.description,
    content: htmlContent,
    toc,
  };
}

const ORDER = ['index', 'guide', 'api', 'deployment', 'changelog'];

export async function getDocsInOrder(): Promise<Doc[]> {
  const slugs = await getDocSlugs();
  const docs = await Promise.all(slugs.map((s) => getDocBySlug(s)));
  return docs
    .filter((d): d is Doc => d !== null)
    .sort((a, b) => {
      const ai = ORDER.indexOf(a.slug);
      const bi = ORDER.indexOf(b.slug);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
}
