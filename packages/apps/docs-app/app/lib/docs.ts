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
import type { Root, Heading, Code, Text as MdastText } from 'mdast';
import type { Element, Root as HastRoot, Text as HastText } from 'hast';
import { visit } from 'unist-util-visit';

const docsDir = path.join(process.cwd(), 'app/docs');

export type DocType = 'blog' | 'docs';
export type DocLayout = 'reading' | 'wide';

const DEFAULT_CATEGORY = 'Uncategorized';

interface DocFrontmatter {
  title: string;
  date: string;
  description: string;
  tags?: string[];
  type?: DocType;
  category?: string;
  layout?: DocLayout;
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
  date: string;
  description: string;
  content: string;
  toc: TocItem[];
  tags: string[];
  type: DocType;
  category?: string;
  layout: DocLayout;
}

// Normalize a frontmatter date into a `YYYY-MM-DD` string.
// gray-matter parses unquoted YAML dates into Date objects; keep the original
// short form instead of a full Date.toString().
function normalizeDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return value != null ? String(value) : '';
}

// Normalize raw frontmatter (parsed by gray-matter) into a typed DocFrontmatter.
// Applies fallbacks: missing `type` defaults to `blog` (with a build-time warning),
// docs without `category` fall back to `Uncategorized`, blog ignores `category`.
function normalizeFrontmatter(data: Record<string, unknown>, slug: string): DocFrontmatter {
  const rawTags = data.tags;
  const tags = Array.isArray(rawTags) ? rawTags.map((t) => String(t)).filter((t) => t.length > 0) : [];

  let type: DocType;
  if (data.type === 'blog' || data.type === 'docs') {
    type = data.type;
  } else {
    if (data.type !== undefined) {
      console.warn(`[docs] "${slug}" has invalid type "${String(data.type)}", defaulting to "blog"`);
    } else {
      console.warn(`[docs] "${slug}" is missing frontmatter "type", defaulting to "blog"`);
    }
    type = 'blog';
  }

  const category =
    type === 'docs'
      ? typeof data.category === 'string' && data.category.trim()
        ? data.category.trim()
        : DEFAULT_CATEGORY
      : undefined;

  const layout: DocLayout = data.layout === 'wide' ? 'wide' : 'reading';

  return {
    title: typeof data.title === 'string' ? data.title : '',
    date: normalizeDate(data.date),
    description: typeof data.description === 'string' ? data.description : '',
    tags,
    type,
    category,
    layout,
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
function getMdastTextContent(node: Heading | Code | MdastText): string {
  if (node.type === 'text') {
    return node.value;
  }
  if ('children' in node && node.children) {
    return node.children.map((child) => getMdastTextContent(child as Heading | Code | MdastText)).join('');
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

    // Find appropriate parent level
    while (stack.length > 1 && stack[stack.length - 1].depth >= node.depth) {
      stack.pop();
    }

    stack[stack.length - 1].items.push(item);
    stack.push({ depth: node.depth, items: item.children });
  });

  return headings;
}

// Get text content from an element recursively
function getTextContent(node: Element | HastText): string {
  if (node.type === 'text') {
    return node.value;
  }
  if (node.type === 'element' && node.children) {
    return node.children.map((child) => getTextContent(child as Element | HastText)).join('');
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
    .use(() => (tree: Root) => {
      // Mark mermaid code blocks - clear lang to prevent highlighting
      visit(tree, 'code', (node: Code) => {
        if (node.lang === 'mermaid') {
          // Store original mermaid code and mark for special handling
          node.data = {
            ...node.data,
            hProperties: { className: ['mermaid-raw'] },
          };
          // Clear lang so rehype-highlight won't process it
          node.lang = undefined;
          node.meta = undefined;
        }
      });
    })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(() => (tree: HastRoot) => {
      // Handle mermaid blocks before rehype-highlight
      visit(tree, 'element', (node: Element) => {
        if (node.tagName === 'pre' && node.children?.[0]?.type === 'element') {
          const codeNode = node.children[0] as Element;
          const classes = (codeNode.properties?.className as string[]) || [];
          if (classes.includes('mermaid-raw')) {
            // Get the text content from code block
            const textContent =
              codeNode.children
                ?.filter((child): child is HastText => child.type === 'text')
                ?.map((child) => child.value)
                ?.join('') || '';
            // Replace with simple pre.mermaid containing the raw text
            node.tagName = 'pre';
            node.properties = { className: ['mermaid'] };
            node.children = [{ type: 'text', value: textContent }];
          }
        }
      });
    })
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

  const raw = fs.readFileSync(actualPath, 'utf-8');
  const { data, content: body } = matter(raw);
  const frontmatter = normalizeFrontmatter(data as Record<string, unknown>, slug);
  const { content: htmlContent, toc } = await processMarkdown(body);

  return {
    slug,
    title: frontmatter.title || slug,
    date: frontmatter.date,
    description: frontmatter.description,
    content: htmlContent,
    toc,
    tags: frontmatter.tags || [],
    type: frontmatter.type ?? 'blog',
    category: frontmatter.category,
    layout: frontmatter.layout ?? 'reading',
  };
}

export async function getAllDocs(): Promise<Doc[]> {
  const slugs = await getDocSlugs();
  const docs = await Promise.all(slugs.map((slug) => getDocBySlug(slug)));

  return docs
    .filter((doc): doc is Doc => doc !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export interface TagInfo {
  name: string;
  count: number;
}

export async function getAllTags(): Promise<TagInfo[]> {
  const docs = await getAllDocs();
  const tagMap = new Map<string, number>();

  for (const doc of docs) {
    for (const tag of doc.tags) {
      const count = tagMap.get(tag) || 0;
      tagMap.set(tag, count + 1);
    }
  }

  const tags: TagInfo[] = [];
  for (const [name, count] of tagMap.entries()) {
    tags.push({ name, count });
  }

  return tags.sort((a, b) => b.count - a.count);
}

export async function getDocsByTag(tag: string): Promise<Doc[]> {
  const docs = await getAllDocs();
  return docs.filter((doc) => doc.tags.includes(tag));
}

// Filter docs by content type (already sorted by date desc via getAllDocs)
export async function getDocsByType(type: DocType): Promise<Doc[]> {
  const docs = await getAllDocs();
  return docs.filter((doc) => doc.type === type);
}

export interface DocCategory {
  category: string;
  docs: Doc[];
}

// Group `docs`-type documents by their category, preserving date-desc order within each group.
export async function getDocCategories(): Promise<DocCategory[]> {
  const docs = await getDocsByType('docs');
  const groupMap = new Map<string, Doc[]>();

  for (const doc of docs) {
    const category = doc.category || DEFAULT_CATEGORY;
    const group = groupMap.get(category);
    if (group) {
      group.push(doc);
    } else {
      groupMap.set(category, [doc]);
    }
  }

  return Array.from(groupMap.entries()).map(([category, categoryDocs]) => ({ category, docs: categoryDocs }));
}

// ---- 知识图谱数据 ----

export interface GraphNode {
  id: string;
  label: string;
  kind: 'doc' | 'tag';
  /** 文章节点的分类（用于着色）；标签节点为该标签文章计数 */
  group?: string;
  weight: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * 构建首页知识图谱：文章与标签为节点，文章-标签关系为边。
 * 在服务端（loader/prerender）计算并序列化传给客户端渲染。
 * 为控制规模，仅纳入被至少一篇文章使用的标签，边为「文章→其标签」。
 */
export async function getGraphData(): Promise<GraphData> {
  const docs = await getAllDocs();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const tagCount = new Map<string, number>();

  for (const doc of docs) {
    for (const tag of doc.tags) {
      tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
    }
  }

  for (const doc of docs) {
    const docId = `doc:${doc.slug}`;
    nodes.push({
      id: docId,
      label: doc.title,
      kind: 'doc',
      group: doc.type === 'docs' ? doc.category || DEFAULT_CATEGORY : 'Blog',
      weight: 1 + doc.tags.length,
    });
    for (const tag of doc.tags) {
      edges.push({ source: docId, target: `tag:${tag}`, weight: 1 });
    }
  }

  for (const [tag, count] of tagCount.entries()) {
    nodes.push({ id: `tag:${tag}`, label: tag, kind: 'tag', weight: count });
  }

  return { nodes, edges };
}
