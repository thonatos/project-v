import type { Route } from './+types/docs._index';
import { Link } from 'react-router';
import { DocsShell } from '~/components/docs-shell';
import { getDocCategories } from '~/lib/docs';
import { pageTitle } from '~/lib/seo';

export function meta() {
  return [{ title: pageTitle('Docs') }, { name: 'description', content: '用于整理和维护可持续查阅的文档。' }];
}

export async function loader() {
  return { categories: await getDocCategories() };
}

export default function DocsIndex({ loaderData }: Route.ComponentProps) {
  return (
    <DocsShell categories={loaderData.categories}>
      <header className="page-intro docs-intro">
        <h1>Docs</h1>
        <p>用于整理和维护可持续查阅的文档。</p>
      </header>
      <div className="docs-index">
        {loaderData.categories.map((group) => (
          <section key={group.category} id={encodeURIComponent(group.category)}>
            <div className="docs-index-heading">
              <h2>{group.category}</h2>
              <span>{group.docs.length} 篇</span>
            </div>
            <div>
              {group.docs.map((doc) => (
                <Link key={doc.slug} to={doc.href} className="doc-index-row">
                  <div>
                    <h3>{doc.title}</h3>
                    <p>{doc.description}</p>
                  </div>
                  <time dateTime={doc.date}>更新 {doc.date}</time>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </DocsShell>
  );
}
