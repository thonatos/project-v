import { useLoaderData } from 'react-router';

import { AppShellHeader } from '~/components/app-shell';
import { AppShellFooter } from '~/components/app-shell-footer';
import { Hero } from '~/components/landing/hero';
import { Features } from '~/components/landing/features';
import { getUser } from '~/lib/auth.server';
import { getTheme } from '~/lib/theme.server';

import type { Route } from './+types/_index';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);
  const theme = getTheme(request);
  return { user, theme };
}

export function meta() {
  return [
    { title: 'i18n-studio · 多语言词条管理工作流' },
    {
      name: 'description',
      content:
        '把多语言词条管理建模成 Pull Request 一样的工作流。草稿 → 发布 → 历史,跨命名空间同步,翻译任务,Snapshot 缓存通道,内置 OpenAPI 文档。',
    },
  ];
}

export default function Index() {
  const { user, theme } = useLoaderData<typeof loader>();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppShellHeader user={user} theme={theme} />
      <main className="flex-1">
        <Hero user={user} />
        <Features />
      </main>
      <AppShellFooter />
    </div>
  );
}
