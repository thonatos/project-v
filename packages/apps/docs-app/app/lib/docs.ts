import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

const docsDir = path.join(process.cwd(), 'app/docs');

interface DocFrontmatter {
  title: string;
  date: string;
  description: string;
}

interface Doc {
  slug: string;
  title: string;
  date: string;
  description: string;
  content: string;
}

function parseFrontmatter(content: string): { frontmatter: DocFrontmatter; body: string } {
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
  const { frontmatter, body } = parseFrontmatter(content);
  const htmlContent = marked.parse(body) as string;

  return {
    slug,
    title: frontmatter.title || slug,
    date: frontmatter.date,
    description: frontmatter.description,
    content: htmlContent,
  };
}

export async function getAllDocs(): Promise<Doc[]> {
  const slugs = await getDocSlugs();
  const docs = await Promise.all(slugs.map((slug) => getDocBySlug(slug)));

  return docs
    .filter((doc): doc is Doc => doc !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
