import React from 'react';
import classnames from 'classnames';
import { Link, NavLink } from '@remix-run/react';
import { DarkThemeToggle, Navbar, Dropdown, Avatar } from 'flowbite-react';

const NavLinks = [
  { name: 'Home', href: '/' },
  { name: 'Docs', href: '/docs' },
  { name: 'Demo', href: '/demo' },
  { name: 'Nostr', href: '/nostr' },
  { name: 'Links', href: '/links' },
];

const ExtLinks = [
  {
    name: 'Github',
    href: 'https://github.com/thonatos/pV-remix',
    icon: '/images/github-mark/github-mark.png',
  },
];

const NavMain = () => {
  return (
    <div className="flex gap-8">
      {/* nav links */}
      <div className="flex items-center">
        {NavLinks.map((link, index) => {
          return (
            <NavLink
              key={index}
              to={link.href}
              className={({ isActive }) =>
                classnames(
                  `p-2 py-2.5 text-sm underline-offset-8 hover:underline text-gray-500 decoration-gray-200`,
                  {
                    underline: isActive,
                  }
                )
              }
            >
              {link.name}
            </NavLink>
          );
        })}
      </div>

      {/* ext links */}
      <div className="flex items-center gap-2">
        {ExtLinks.map((link, index) => {
          return (
            <Link
              key={index}
              to={link.href}
              className="h-10 w-10 place-items-center text-black hover:text-gray-600 grid"
              title={link.name}
            >
              <span className="sr-only">{link.name}</span>
              <img
                src={link.icon}
                alt=""
                style={{
                  width: '24px',
                  height: '24px',
                }}
              />
            </Link>
          );
        })}

        {/* theme toggle */}
        <DarkThemeToggle className="p-[2px]" />
      </div>
    </div>
  );
};

export const Header: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-2.5 dark:bg-gray-800 dark:border-gray-700 fixed left-0 right-0 top-0 z-50">
      <Navbar fluid rounded>
        <div className="flex gap-2">
          <Navbar.Toggle />
          <Navbar.Brand>
            <div className="flex w-full items-center justify-between gap-8 md:w-auto">
              <NavLink className="flex" to="/">
                <span className="logo">ρV</span>
              </NavLink>
            </div>
          </Navbar.Brand>
        </div>

        {/* <div className="flex md:order-2">
          <Dropdown
            arrowIcon={false}
            inline
            label={
              <Avatar
                alt="User settings"
                img="https://flowbite.com/docs/images/people/profile-picture-5.jpg"
                rounded
              />
            }
          >
            <Dropdown.Header>
              <span className="block text-sm">Bonnie Green</span>
              <span className="block truncate text-sm font-medium">name@flowbite.com</span>
            </Dropdown.Header>
            <Dropdown.Item>Dashboard</Dropdown.Item>
            <Dropdown.Item>Settings</Dropdown.Item>
            <Dropdown.Item>Earnings</Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item>Sign out</Dropdown.Item>
          </Dropdown>
        </div>
         */}
        <Navbar.Collapse>
          {NavLinks.map((link, index) => {
            return (
              <Navbar.Link as={NavLink} key={index} to={link.href}>
                {link.name}
              </Navbar.Link>
            );
          })}
        </Navbar.Collapse>
      </Navbar>
    </nav>
  );
};
