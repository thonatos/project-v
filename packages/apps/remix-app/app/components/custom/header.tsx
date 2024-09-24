import React from 'react';
import { NavLink } from '@remix-run/react';
import { PanelLeft } from 'lucide-react';

import { Button } from '~/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '~/components/ui/sheet';
import { Logo } from './header-logo';
import { SearchBar } from './header-search-bar';
import { Breadcrumbs } from './header-breadcrumbs';
import { DropdownMenus } from './header-dropdown-menus';

export const Header: React.FC<{
  navLinks?: { icon: any; label: string; pathname: string }[];
  dropdownMenus?: { label?: string; type?: string }[];
}> = ({ navLinks = [], dropdownMenus = [] }) => {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden">
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs">
          <nav className="grid gap-4 text-lg font-medium">
            <Logo title="ρV" />

            {navLinks.map((nav, index) => (
              <NavLinkItem key={index} icon={nav.icon} label={nav.label} pathname={nav.pathname} />
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <Breadcrumbs />

      <SearchBar />

      <DropdownMenus dropdownMenus={dropdownMenus} />
    </header>
  );
};

interface NavLinkItemProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  pathname: string;
}

const NavLinkItem: React.FC<NavLinkItemProps> = ({ icon: Icon, label, pathname }) => {
  return (
    <NavLink
      to={pathname}
      className={(props) => {
        const { isActive, isPending } = props;
        const defaultStyle = 'flex items-center gap-4 px-2.5 ';
        return isPending
          ? defaultStyle
          : isActive
          ? `${defaultStyle} text-foreground`
          : `${defaultStyle} text-muted-foreground hover:text-foreground`;
      }}
    >
      <Icon className="h-5 w-5" />
      {label}
    </NavLink>
  );
};
