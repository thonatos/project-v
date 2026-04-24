import { useAtomValue } from 'jotai';
import { BotIcon, EditIcon, FolderGit, HelpCircleIcon, Home } from 'lucide-react';
import type React from 'react';
import { NavLink, useLocation } from 'react-router';
import Logo from '~/components/biz/logo';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '~/components/ui/sidebar';
import { profileAtom } from '~/store/authAtom';

const NavLinks = [
  { icon: Home, label: 'Home', pathname: '/' },
  { icon: FolderGit, label: 'Github Stars', pathname: '/github/stars' },
  { icon: EditIcon, label: 'Editor', pathname: '/dash/post', needLogin: true },
  { icon: BotIcon, label: 'Chat', pathname: '/dash/chat', needLogin: true },
  { icon: HelpCircleIcon, label: 'Support', pathname: '/support' },
];

export const CustomSidebar: React.FC = () => {
  const location = useLocation();
  const profile = useAtomValue(profileAtom);
  const navLinks = NavLinks.filter((item) => {
    return item?.needLogin ? !!profile : true;
  });

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
        <SidebarHeader>
          <div className="flex justify-center items-center">
            <Logo title="ρV" description="undefined project" />
          </div>
        </SidebarHeader>

        <SidebarContent className="p-2"></SidebarContent>
      </Sidebar>
    </Sidebar>
  );
};
