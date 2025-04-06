import { useEffect, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useLocation } from 'react-router';

import { ChatCard } from '~/components/biz/chat-card';
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar';
import { Header } from './header';
import { CustomSidebar } from './sidebar';
import { profileAtom, loadProfileAtom } from '~/store/authAtom';

export const DefaultLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const location = useLocation();
  const profile = useAtomValue(profileAtom);
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
      <CustomSidebar asistant={<ChatCard disabled={!isOpen || !profile} />} />
      <SidebarInset>
        <div className="flex flex-col sm:gap-4 sm:py-4">
          <Header />
          <main className="grid flex-1 items-start gap-4 p-4 md:gap-8 sm:border-t">{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};
