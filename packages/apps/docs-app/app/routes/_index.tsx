import { ArticleCard } from '~/components/article-card';

// Glob import all MDX files to get frontmatter
const docsModules = import.meta.glob<{ frontmatter: { title: string; date: string; description: string; image?: string } }>(
  './docs/*.mdx',
  { eager: true }
);

const manuscriptsModules = import.meta.glob<{ frontmatter: { title: string; date: string; description: string; image?: string } }>(
  './manuscripts/*.mdx',
  { eager: true }
);

export function meta() {
  return [
    { title: 'Docs App' },
    { name: 'description', content: '文档和手稿展示站点' },
  ];
}

export default function Index() {
  const docsList = Object.entries(docsModules)
    .filter(([path]) => !path.includes('_layout'))
    .map(([path, module]) => ({
      slug: path.replace('./docs/', '').replace('.mdx', ''),
      frontmatter: module.frontmatter,
    }))
    .sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime());

  const manuscriptsList = Object.entries(manuscriptsModules)
    .filter(([path]) => !path.includes('_layout'))
    .map(([path, module]) => ({
      slug: path.replace('./manuscripts/', '').replace('.mdx', ''),
      frontmatter: module.frontmatter,
    }))
    .sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime());

  const allArticles = [...docsList, ...manuscriptsList];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section - Tailwind Blog style */}
      <header className="mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
          最新更新
        </h1>
        <p className="text-lg text-[var(--color-text-muted)] max-w-2xl">
          所有文档和手稿，持续更新中。
        </p>
      </header>

      {/* Articles List - Tailwind Blog style */}
      <div className="space-y-8">
        {allArticles.map((article, index) => (
          <ArticleCard
            key={article.slug}
            href={article.slug.startsWith('getting-started') ? `/docs/${article.slug}` : `/manuscripts/${article.slug}`}
            title={article.frontmatter.title}
            date={article.frontmatter.date}
            description={article.frontmatter.description}
            image={article.frontmatter.image}
            featured={index === 0}
          />
        ))}
      </div>
    </div>
  );
}