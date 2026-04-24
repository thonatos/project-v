import { useAtomValue, useSetAtom } from 'jotai';
import type React from 'react';
import { useNavigate } from 'react-router';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { REMIX_API } from '~/constants';
import { profileAtom, resetProfileAtom } from '~/store/authAtom';

const menus = [
  { label: 'Account', type: 'Label' },
  { type: 'Separator' },
  { label: 'Profile', key: 'profile', href: '/dash/profile' },
  { label: 'Support', key: 'support', href: '/support' },
  { type: 'Separator' },
  { label: 'Logout', key: 'logout' },
];

export const Dropdown: React.FC = () => {
  const navigate = useNavigate();
  const profile = useAtomValue(profileAtom);
  const resetProfile = useSetAtom(resetProfileAtom);

  const avatarUrl = profile?.avatar_url;

  const handleClick = (key?: string) => {
    const targetHref = menus.find((menu) => menu.key === key)?.href;

    if (key === 'login') {
      navigate('/auth/login');
      return;
    }

    if (key === 'logout') {
      resetProfile();
      window.location.href = `${REMIX_API}/auth/logout`;
      return;
    }

    if (targetHref) {
      navigate(targetHref);
    }
  };

  if (!avatarUrl) {
    return (
      <Button
        className="px-4"
        size="sm"
        onClick={() => {
          handleClick('login');
        }}
      >
        Login
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
