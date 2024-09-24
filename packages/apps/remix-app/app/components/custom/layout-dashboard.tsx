import React from 'react';
import { Home, LineChart } from 'lucide-react';

import { Header } from './header';
import { Sidebar } from './sidebar';

const NavLinks = [
  { icon: Home, label: 'Home', pathname: '/' },
  { icon: LineChart, label: 'Analytics', pathname: '/analytics' },
];

const DropdownMenus = [
  { label: 'Profile', type: 'Label' },
  { type: 'Separator' },
  // { label: 'Settings' },
  { label: 'Support' },
  // { type: 'Separator' },
  // { label: 'Logout' },
];

export const LayoutDashboard: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <Sidebar navLinks={NavLinks} />
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
        <Header navLinks={NavLinks} dropdownMenus={DropdownMenus} />
        <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">{children}</main>
      </div>
    </div>
  );
};
