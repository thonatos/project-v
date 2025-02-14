import React from 'react';
import { Github } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '~/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';

export const Dropdown: React.FC<{
  avatarUrl?: string;
  menus?: { label?: string; type?: string; key?: string }[];
  onSelect?: (key: string) => void;
}> = ({ avatarUrl, menus = [], onSelect }) => {
  const handleClick = (key?: string) => {
    if (!key || !onSelect) return;
    onSelect(key);
  };

  if (!avatarUrl) {
    return (
      <Button
        size="sm"
        onClick={() => {
          handleClick('login');
        }}
      >
        <Github /> Login with Github
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
          <Avatar className="w-6 h-6">
            <AvatarImage src={avatarUrl} alt="Avatar" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {menus.map((item) => {
          if (item.type === 'Label') {
            return <DropdownMenuLabel key={item.label}>{item.label}</DropdownMenuLabel>;
          }

          if (item.type === 'Separator') {
            return <DropdownMenuSeparator key={Math.random()} />;
          }

          return (
            <DropdownMenuItem
              key={item.label}
              onSelect={() => {
                handleClick(item?.key);
              }}
            >
              {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default Dropdown;
