import fs from 'node:fs';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import type { Root, Heading, Code, Text } from 'mdast';
import type { Element, Root as HastRoot } from 'hast';
import { visit } from 'unist-util-visit';

const docsDir = path.join(process.cwd(), 'app/docs');

interface DocFrontmatter {
  title: string;
  date: string;
  description: string;
}

interface TocItem {
  id: string;
  text: string;
  depth: number;
  children: TocItem[];
}

interface Doc {
  slug: string;
  title: string;
  date: string;
  description: string;
  content: string;
  toc: TocItem[];
}

// Extract frontmatter from markdown content
function extractFrontmatter(content: string): { frontmatter: DocFrontmatter; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return {
      frontmatter: { title: 'Untitled', date: '', description: '' },
      body: content,
    };
  }

  const frontmatterStr = match[1];
  const body = content.slice(match[0].length);

  const frontmatter: DocFrontmatter = { title: '', date: '', description: '' };

  frontmatterStr.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split(':');
    const value = valueParts.join(':').trim();
    if (key === 'title') frontmatter.title = value;
    if (key === 'date') frontmatter.date = value;
    if (key === 'description') frontmatter.description = value;
  });

  return { frontmatter, body };
}

// Generate unique heading ID
function generateHeadingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

// Extract TOC from markdown AST
function extractToc(tree: Root): TocItem[] {
  const headings: TocItem[] = [];
  const stack: { depth: number; items: TocItem[] }[] = [{ depth: 0, items: headings }];

  visit(tree, 'heading', (node: Heading) => {
    if (node.depth < 1 || node.depth > 3) return;

    const text = node.children
      .filter((child): child is Text => child.type === 'text')
      .map((child) => child.value)
      .join('');

    const id = generateHeadingId(text);
    const item: TocItem = { id, text, depth: node.depth, children: [] };

    // Find appropriate parent level
    while (stack.length > 1 && stack[stack.length - 1].depth >= node.depth) {
      stack.pop();
    }

    stack[stack.length - 1].items.push(item);
    stack.push({ depth: node.depth, items: item.children });
  });

  return headings;
}

// Add heading IDs to hast tree
function addHeadingIds(tree: HastRoot): void {
  visit(tree, 'element', (node: Element) => {
    if (['h1', 'h2', 'h3'].includes(node.tagName)) {
      const text = node.children
        .filter((child): child is Text => child.type === 'text')
        .map((child) => child.value)
        .join('');
      node.properties = { ...node.properties, id: generateHeadingId(text) };
    }
  });
}

// Preserve mermaid code blocks (don't highlight)
function preserveMermaidBlocks(): import('unified').Plugin {
  return () => (tree: Root) => {
    visit(tree, 'code', (node: Code) => {
      if (node.lang === 'mermaid') {
        // Mark as mermaid for client-side rendering
        node.data = { ...node.data, hProperties: { className: ['mermaid'] } };
        node.lang = undefined; // Prevent rehype-highlight from processing
      }
    });
  };
}

// Process markdown to HTML with TOC
async function processMarkdown(body: string): Promise<{ content: string; toc: TocItem[] }> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ['yaml'])
    .use(preserveMermaidBlocks)
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
    date: frontmatter.date,
    description: frontmatter.description,
    content: htmlContent,
    toc,
  };
}

export async function getAllDocs(): Promise<Doc[]> {
  const slugs = await getDocSlugs();
  const docs = await Promise.all(slugs.map((slug) => getDocBySlug(slug)));

  return docs
    .filter((doc): doc is Doc => doc !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
