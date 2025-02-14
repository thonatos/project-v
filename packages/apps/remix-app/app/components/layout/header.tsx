import { Separator } from '~/components/ui/separator';
import { SidebarTrigger } from '~/components/ui/sidebar';

import { Dropdown } from './header-dropdown';
import { SearchBar } from './header-search-bar';
import { Breadcrumbs } from './header-breadcrumbs';
// import { ModeToggle } from './header-mode-toggle';

import { Profile } from '~/types';

export const Header: React.FC<{
  profile?: Profile;
  searchValue?: string;
  menus?: { label?: string; type?: string }[];
  onSearch?: (value: string) => void;
  onSelect?: (key: string) => void;
}> = ({ profile, menus = [], searchValue, onSearch, onSelect }) => {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-4">
      <SidebarTrigger className="-ml-1" />

      <Separator orientation="vertical" className="mr-2 h-4" />

      <Breadcrumbs />

      <SearchBar value={searchValue} onSearch={onSearch} />

      <Dropdown avatarUrl={profile?.user_metadata.avatar_url} menus={menus} onSelect={onSelect} />

      {/* <ModeToggle /> */}
    </header>
  );
};
