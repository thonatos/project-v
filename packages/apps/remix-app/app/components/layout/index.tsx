import { useEffect } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useLocation, useNavigate } from '@remix-run/react';
import { Home, LineChart, FolderGit, EditIcon, UserIcon } from 'lucide-react';
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar';
import { Header } from './header';
import { CustomSidebar } from './sidebar';
import { searchAtom } from '~/store/appAtom';
import { profileAtom, loadProfileAtom, resetProfileAtom } from '~/store/authAtom';

const NavLinks = [
  { icon: Home, label: 'Home', pathname: '/' },
  { icon: FolderGit, label: 'Github Stars', pathname: '/github/stars' },
  { icon: LineChart, label: 'Finances', pathname: '/finances' },
];

const AuthedNavLinks = [{ icon: EditIcon, label: 'Editor', pathname: '/dash/add-post' }];

const DropdownMenus = [
  { label: 'Account', type: 'Label' },
  { type: 'Separator' },
  { label: 'Profile', key: 'profile' },
  { label: 'Logout', key: 'logout' },
  { type: 'Separator' },
  { label: 'Support', key: 'support' },
];

export const DefaultLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const profile = useAtomValue(profileAtom);
  const loadProfile = useSetAtom(loadProfileAtom);
  const resetProfile = useSetAtom(resetProfileAtom);
  const [value, setValue] = useAtom(searchAtom);

  useEffect(() => {
    if (profile) return;
    loadProfile();
  }, [profile]);

  if (location.pathname === '/auth/login') {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-4 md:p-8">
        {children}
      </div>
    );
  }

  const handleHeaderDropdownMenuClick = (key: string) => {
    if (key === 'login') {
      navigate('/auth/login');
      return;
    }

    if (key === 'profile') {
      navigate('/auth/profile');
      return;
    }

    if (key === 'logout') {
      resetProfile();
      navigate('/auth/logout');
      return;
    }
  };

  return (
    <SidebarProvider defaultOpen={false}>
      <CustomSidebar navLinks={profile ? [...NavLinks, ...AuthedNavLinks] : NavLinks} />
      <SidebarInset>
        <div className="flex flex-col sm:gap-4 sm:py-4">
          <Header
            profile={profile}
            searchValue={value}
            menus={DropdownMenus}
            onSearch={setValue}
            onSelect={handleHeaderDropdownMenuClick}
          />
          <main className="grid flex-1 items-start gap-4 p-4 md:gap-8 sm:border-t">{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};
