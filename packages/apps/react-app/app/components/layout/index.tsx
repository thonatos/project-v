import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { useSetAtom } from 'jotai';
import { useLocation } from 'react-router';

import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar';
import { Header } from './header';
import { CustomSidebar } from './sidebar';
import { loadProfileAtom } from '~/store/authAtom';

export const DefaultLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const location = useLocation();
  const loadProfile = useSetAtom(loadProfileAtom);

  useEffect(() => {
    loadProfile();
  }, []);

  if (location.pathname === '/auth/login') {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-4 md:p-8">
        {children}
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={false} open={isOpen} onOpenChange={(isOpen) => setIsOpen(isOpen)}>
      <CustomSidebar />
      <SidebarInset>
        <div className="flex flex-col sm:gap-4 sm:py-4">
          {/* header */}
          <Header />

          {/* main content */}
          <main className="grid flex-1 items-start gap-4 p-4 md:gap-8 sm:border-t">{children}</main>

          {/* footer */}
          <footer
            className={clsx('p-4 text-sm text-muted-foreground', {
              hidden: location.pathname.startsWith('/post/'),
            })}
          >
            Built with ❤️ using React Router.
          </footer>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};
