import { Outlet, useLoaderData } from 'react-router';
import { Menu } from 'lucide-react';

import { AppShellHeader } from '~/components/app-shell';
import { AppShellFooter } from '~/components/app-shell-footer';
import { DocsSidebar } from '~/components/docs/docs-sidebar';
import { Button } from '~/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '~/components/ui/sheet';
import { getUser } from '~/lib/auth.server';
import { getDocsInOrder } from '~/lib/docs';
import { getTheme } from '~/lib/theme.server';

import type { Route } from './+types/docs';

export async function loader({ request }: Route.LoaderArgs) {
  const theme = getTheme(request);
  const user = await getUser(request);
  const docs = await getDocsInOrder();
  return {
    theme,
    user,
    sidebar: docs.map((d) => ({ slug: d.slug, title: d.title })),
  };
}

export default function DocsLayout() {
  const { theme, user, sidebar } = useLoaderData<typeof loader>();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppShellHeader
        user={user}
        theme={theme}
        leadingSlot={
          <Sheet>
            <SheetTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="md:hidden" aria-label="打开侧边栏">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="px-3 py-4">
                <DocsSidebar items={sidebar} />
              </div>
            </SheetContent>
          </Sheet>
        }
      />
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 py-6">
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="sticky top-20">
            <DocsSidebar items={sidebar} />
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <article className="space-y-4">
            <Outlet />
          </article>
        </main>
      </div>
      <AppShellFooter />
    </div>
  );
}
