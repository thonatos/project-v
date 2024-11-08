import React from 'react';
import { Home, LineChart, FolderGit } from 'lucide-react';
import { useAtom } from 'jotai';

import { searchAtom } from '~/store/appAtom';

import { Header } from './header';
import { CustomSidebar } from './sidebar';
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar';

const NavLinks = [
  { icon: Home, label: 'Home', pathname: '/' },
  { icon: FolderGit, label: 'Projects', pathname: '/projects' },
  { icon: LineChart, label: 'Analytics', pathname: '/analytics' },
];

const DropdownMenus = [{ label: 'Profile', type: 'Label' }, { type: 'Separator' }, { label: 'Support' }];

export const DefaultLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [value, setValue] = useAtom(searchAtom);

  return (
    <SidebarProvider defaultOpen={false}>
      <CustomSidebar navLinks={NavLinks} />
      <SidebarInset>
        <div className="flex flex-col sm:gap-4 sm:py-4">
          <Header dropdownMenus={DropdownMenus} searchValue={value} onSearch={setValue} />
          <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};
