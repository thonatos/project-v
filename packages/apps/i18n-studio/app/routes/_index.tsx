import { Form, useLoaderData } from 'react-router';

import { requireUser } from '~/lib/auth.server';
import { listNamespaces } from '~/lib/services/namespace.server';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';

import type { Route } from './+types/_index';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const namespaces = listNamespaces(user.id);
  return { user, namespaces };
}

export default function Index() {
  const { user, namespaces } = useLoaderData<typeof loader>();
  return (
    <main className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Namespaces</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <a href="/ns/new">+ New namespace</a>
          </Button>
          <Form method="post" action="/logout">
            <Button type="submit" variant="ghost">
              Logout
            </Button>
          </Form>
        </div>
      </div>
      {namespaces.length === 0 ? (
        <p className="text-muted-foreground">尚未加入任何命名空间。</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {namespaces.map((ns) => {
            const locales = JSON.parse(ns.locales) as string[];
            return (
              <a key={ns.id} href={`/ns/${ns.slug}`} className="block">
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader>
                    <CardTitle>{ns.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">slug: {ns.slug}</p>
                    <p className="text-sm">{locales.length} locales</p>
                    <p className="text-xs text-muted-foreground">role: {ns.role}</p>
                  </CardContent>
                </Card>
              </a>
            );
          })}
        </div>
      )}
    </main>
  );
}
