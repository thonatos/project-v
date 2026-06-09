import { Outlet } from 'react-router';

import { AppShellFooter } from '~/components/app-shell-footer';
import { requireUser } from '~/lib/auth.server';
import { getTheme } from '~/lib/theme.server';
import { getLang } from '~/lib/i18n.server';
import type { Theme } from '~/lib/theme';
import type { Lang } from '~/lib/i18n';

import type { Route } from './+types/dashboard';

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const theme = getTheme(request);
  const lang = getLang(request);
  return {
    user: { id: user.id, email: user.email, displayName: user.displayName, isSuperuser: user.isSuperuser },
    theme,
    lang,
  };
}

/**
 * outlet context 透传给所有 `/dashboard/**` 子路由,集中托管 user / theme / lang。
 * 子路由 MUST NOT 各自再调 `requireUser` / `getTheme` / `getLang` 仅为 header 渲染。
 */
export interface DashboardContext {
  user: {
    id: string;
    email: string;
    displayName: string | null;
    isSuperuser: boolean;
  };
  theme: Theme;
  lang: Lang;
}

export default function DashboardLayout({ loaderData }: Route.ComponentProps) {
  const ctx: DashboardContext = { user: loaderData.user, theme: loaderData.theme, lang: loaderData.lang };
  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <div className="flex-1">
        <Outlet context={ctx} />
      </div>
      <AppShellFooter />
    </div>
  );
}
