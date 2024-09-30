import React from 'react';
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

export const Profile: React.FC<{
  dropdownMenus?: { label?: string; type?: string }[];
}> = ({ dropdownMenus = [] }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
          <Avatar className="w-6 h-6">
            <AvatarImage src="https://avatars.githubusercontent.com/u/958063?v=4" alt="Avatar" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {dropdownMenus.map((item) => {
          if (item.type === 'Label') {
            return <DropdownMenuLabel key={item.label}>{item.label}</DropdownMenuLabel>;
          }

          if (item.type === 'Separator') {
            return <DropdownMenuSeparator key={Math.random()} />;
          }

          return <DropdownMenuItem key={item.label}>{item.label}</DropdownMenuItem>;
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default Profile;
