import { useEffect, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useLocation, useNavigate } from '@remix-run/react';
import { Home, LineChart, FolderGit, EditIcon, HelpCircleIcon } from 'lucide-react';
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar';
import { ChatCard } from '~/components/biz/chat-card';
import { Header } from './header';
import { CustomSidebar } from './sidebar';
import { searchAtom } from '~/store/appAtom';
import { profileAtom, loadProfileAtom, resetProfileAtom, tokenAtom } from '~/store/authAtom';
import { clearMessagesAtom, messagesAtom, sendMessageAtom } from '~/store/workerAtom';

const NavLinks = [
  { icon: Home, label: 'Home', pathname: '/' },
  { icon: FolderGit, label: 'Github Stars', pathname: '/github/stars' },
  { icon: LineChart, label: 'Finances', pathname: '/finances' },
  { icon: HelpCircleIcon, label: 'Support', pathname: '/support' },
];

const AuthedNavLinks = [{ icon: EditIcon, label: 'Editor', pathname: '/dash/add-post' }];

const DropdownMenus = [
  { label: 'Account', type: 'Label' },
  { type: 'Separator' },
  { label: 'Profile', key: 'profile', href: '/auth/profile' },
  { label: 'Logout', key: 'logout', href: '/auth/logout' },
  { type: 'Separator' },
  { label: 'Support', key: 'support', href: '/support' },
];

export const DefaultLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const token = useAtomValue(tokenAtom);
  const profile = useAtomValue(profileAtom);
  const loadProfile = useSetAtom(loadProfileAtom);
  const resetProfile = useSetAtom(resetProfileAtom);

  const messages = useAtomValue(messagesAtom);
  const sendMessage = useSetAtom(sendMessageAtom);
  const clearMessages = useSetAtom(clearMessagesAtom);

  const [searchValue, setSearchValue] = useAtom(searchAtom);

  const handleHeaderDropdownMenuClick = (key: string) => {
    const targetHref = DropdownMenus.find((menu) => menu.key === key)?.href;

    if (key === 'login') {
      navigate('/auth/login');
      return;
    }

    if (key === 'logout') {
      resetProfile();
    }

    if (targetHref) {
      navigate(targetHref);
    }
  };

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
      <CustomSidebar
        navLinks={profile ? [...NavLinks, ...AuthedNavLinks] : NavLinks}
        asistant={
          <ChatCard
            disabled={!isOpen || !profile}
            messages={messages}
            onSendMessage={(message) => {
              sendMessage(message, token || '');
            }}
            onClearMessages={() => {
              clearMessages();
            }}
          />
        }
      />
      <SidebarInset>
        <div className="flex flex-col sm:gap-4 sm:py-4">
          <Header
            profile={profile}
            searchValue={searchValue}
            menus={DropdownMenus}
            onSearch={setSearchValue}
            onSelect={handleHeaderDropdownMenuClick}
          />
          <main className="grid flex-1 items-start gap-4 p-4 md:gap-8 sm:border-t">{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};
