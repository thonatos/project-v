import React from 'react';
import { NavLink } from '@remix-run/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';

export const Sidebar: React.FC<{
  navLinks?: { icon: any; label: string; pathname: string }[];
}> = ({ navLinks = [] }) => {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
      <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
        {navLinks.map((nav, index) => (
          <SidebarLink key={index} icon={nav.icon} label={nav.label} pathname={nav.pathname} />
        ))}
      </nav>
    </aside>
  );
};

interface SidebarLinkProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  pathname: string;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({ icon: Icon, label, pathname }) => {
  return (
    <NavLink
      to={pathname}
      className={(props) => {
        const { isActive, isPending } = props;
        const defaultStyle =
          'flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:text-foreground md:h-8 md:w-8';
        return isPending
          ? defaultStyle
          : isActive
          ? `${defaultStyle} bg-accent text-accent-foreground`
          : `${defaultStyle} text-muted-foreground`;
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Icon className="h-5 w-5" />
          {/* <span className="sr-only">{label}</span> */}
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    </NavLink>
  );
};
