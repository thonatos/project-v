import { NavLink, useLocation } from '@remix-run/react';

import {
  Sidebar,
  // SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '~/components/ui/sidebar';

import React from 'react';

export const CustomSidebar: React.FC<{
  navLinks?: { icon: any; label: string; pathname: string }[];
  asistant?: React.ReactNode;
}> = ({ navLinks = [], asistant }) => {
  const location = useLocation();

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
