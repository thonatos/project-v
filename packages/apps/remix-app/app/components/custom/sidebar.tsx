import React from 'react';
import { Link } from '@remix-run/react';
import { Home, LineChart, Package, Package2, Settings, ShoppingCart, Users2 } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';

export const Sidebar: React.FC = () => {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
      <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
        <Link
          to="#"
          className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
        >
          <Package2 className="h-4 w-4 transition-all group-hover:scale-110" />
          <span className="sr-only">Acme Inc</span>
        </Link>
        <SidebarLink icon={Home} label="Dashboard" />
        <SidebarLink icon={ShoppingCart} label="Orders" isActive />
        <SidebarLink icon={Package} label="Products" />
        <SidebarLink icon={Users2} label="Customers" />
        <SidebarLink icon={LineChart} label="Analytics" />
      </nav>
      <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
        <SidebarLink icon={Settings} label="Settings" />
      </nav>
    </aside>
  );
};

interface SidebarLinkProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  isActive?: boolean;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({ icon: Icon, label, isActive = false }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to="#"
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:text-foreground md:h-8 md:w-8 ${
            isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
          }`}
        >
          <Icon className="h-5 w-5" />
          <span className="sr-only">{label}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
};
