import React from 'react';
import { Separator } from '~/components/ui/separator';
import { SidebarTrigger } from '~/components/ui/sidebar';

import { Profile } from './header-profile';
import { SearchBar } from './header-search-bar';
import { ModeToggle } from './header-mode-toggle';
import { Breadcrumbs } from './header-breadcrumbs';

export const Header: React.FC<{
  dropdownMenus?: { label?: string; type?: string }[];
  searchValue?: string;
  onSearch?: (value: string) => void;
}> = ({ dropdownMenus = [], searchValue, onSearch }) => {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <SidebarTrigger className="-ml-1" />

      <Separator orientation="vertical" className="mr-2 h-4" />

      <Breadcrumbs />

      <SearchBar value={searchValue} onSearch={onSearch} />

      <Profile dropdownMenus={dropdownMenus} />

      <ModeToggle />
    </header>
  );
};
