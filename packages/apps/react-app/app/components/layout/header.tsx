import React from 'react';
import { Separator } from '~/components/ui/separator';
import { SidebarTrigger } from '~/components/ui/sidebar';

import { Dropdown } from './header-dropdown';
import { SearchBar } from './header-search-bar';
import { Breadcrumbs } from './header-breadcrumbs';
import { ModeToggle } from './header-mode-toggle';

export const Header: React.FC<{}> = () => {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-4">
      <SidebarTrigger className="-ml-1" />

      <Separator orientation="vertical" className="mr-2 h-4" />

      <Breadcrumbs />

      <SearchBar />

      <Dropdown />

      <ModeToggle />
    </header>
  );
};
