import type { Route } from './+types/docs.$slug';
import { getDocBySlug } from '~/lib/docs';

export async function loader({ params }: Route.LoaderArgs) {
  const doc = await getDocBySlug(params.slug);
  if (!doc) {
    throw new Response('Not Found', { status: 404 });
  }
  return doc;
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `ρV - ${data.title}` }, { name: 'description', content: data.description }];
}

export default function DocPage({ loaderData }: Route.ComponentProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <header className="mb-8">
        <time className="text-sm text-[var(--color-text-muted)] mb-2 block">{loaderData.date}</time>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{loaderData.title}</h1>
      </header>

      {/* Content */}
      <article className="prose max-w-none">
        <div dangerouslySetInnerHTML={{ __html: loaderData.content }} />
      </article>
    </div>
  );
}
