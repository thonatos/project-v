import React from 'react';
import { useAtomValue } from 'jotai';
import { NavLink, useLocation } from 'react-router';
import { Home, LineChart, FolderGit, EditIcon, HelpCircleIcon } from 'lucide-react';

import {
  Sidebar,
  // SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '~/components/ui/sidebar';

import { profileAtom } from '~/store/authAtom';

const NavLinks = [
  { icon: Home, label: 'Home', pathname: '/' },
  { icon: FolderGit, label: 'Github Stars', pathname: '/github/stars' },
  { icon: LineChart, label: 'Finances', pathname: '/finances' },
  { icon: HelpCircleIcon, label: 'Support', pathname: '/support' },
];

const AuthedNavLinks = [{ icon: EditIcon, label: 'Editor', pathname: '/dash/add-post' }];

export const CustomSidebar: React.FC<{
  asistant?: React.ReactNode;
}> = ({ asistant }) => {
  const location = useLocation();
  const profile = useAtomValue(profileAtom);
  const navLinks = profile ? [...NavLinks, ...AuthedNavLinks] : NavLinks;

  return (
    <Sidebar collapsible="icon" className="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row">
      <Sidebar collapsible="none" className="!w-[calc(var(--sidebar-width-icon)_+_1px)] border-r">
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {navLinks.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton isActive={item.pathname === location.pathname} asChild>
                    <NavLink to={item.pathname}>
                      <item.icon />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <Sidebar collapsible="none" className="hidden flex-1 md:flex">
        {/* <SidebarHeader>
          <div className="flex justify-center items-center">
            <Logo title="ρV" description="undefined project" />
          </div>
        </SidebarHeader> */}

        <SidebarContent className="p-2">{asistant}</SidebarContent>
      </Sidebar>
    </Sidebar>
  );
};
