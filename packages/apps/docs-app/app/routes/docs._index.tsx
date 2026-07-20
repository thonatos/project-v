import type { Route } from './+types/docs._index';
import { getDocCategories } from '~/lib/docs';
import { Header } from '~/components/header';
import { Footer } from '~/components/footer';
import { ArticleCard } from '~/components/article-card';
import { DesktopCategoryTree, MobileCategoryTree } from '~/components/category-tree';
import { getCategoryColor } from '~/lib/tag-colors';

export function meta() {
  return [{ title: 'ρV - Docs' }, { name: 'description', content: '文档分类列表' }];
}

export async function loader() {
  const categories = await getDocCategories();
  return { categories };
}

export default function DocsIndex({ loaderData }: Route.ComponentProps) {
  const { categories } = loaderData;
  const hasDocs = categories.length > 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main-content" className="flex flex-1 flex-col">
        {hasDocs && <MobileCategoryTree categories={categories} />}
        <div className="grow px-4 sm:px-6 lg:px-8 py-12">
          {hasDocs ? (
            <div className="w-full lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8 lg:max-w-7xl lg:mx-auto">
              <DesktopCategoryTree categories={categories} />
              <div className="min-w-0 space-y-12">
                {categories.map((group) => {
                  const color = getCategoryColor(group.category);
                  return (
                    <section key={group.category} id={encodeURIComponent(group.category)}>
                      <h2 className="mb-4 flex items-center gap-2.5 text-xl font-bold tracking-tight text-[var(--color-text)]">
                        <span
                          aria-hidden
                          className="h-5 w-1.5 rounded-full"
                          style={{ backgroundColor: color.accent }}
                        />
                        {group.category}
                        <span className="text-sm font-normal text-[var(--color-text-muted)]">
                          {group.docs.length} 篇
                        </span>
                      </h2>
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        {group.docs.map((doc) => (
                          <ArticleCard
                            key={doc.slug}
                            variant="grid"
                            href={`/docs/${doc.slug}`}
                            title={doc.title}
                            date={doc.date}
                            description={doc.description}
                            tags={doc.tags}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="lg:max-w-7xl lg:mx-auto">
              <p className="text-[var(--color-text-muted)] text-center py-12">暂无文档</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
