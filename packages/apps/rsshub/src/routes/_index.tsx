import React from 'react';
import { Sidebar, DarkThemeToggle, Flowbite } from 'flowbite-react';
import { FcHome, FcSettings } from 'react-icons/fc';

import { customTheme } from '../theme';
import { NavLink, Outlet } from 'react-router-dom';

export const Root: React.FC<React.PropsWithChildren<{}>> = () => {
  return (
    <Flowbite theme={{ theme: customTheme }}>
      <div className="sidebar fixed top-0 left-0 h-full">
        <Sidebar aria-label="sidebar" collapsed={true}>
          <Sidebar.Items>
            <Sidebar.ItemGroup>
              <Sidebar.Item to="/" icon={FcHome} label="Pro" labelColor="dark" as={NavLink}>
                Home
              </Sidebar.Item>
            </Sidebar.ItemGroup>
          </Sidebar.Items>

          <div className="sidebar-bottom">
            <DarkThemeToggle />
            <Sidebar.ItemGroup>
              <Sidebar.Item to="/settings" icon={FcSettings} as={NavLink}>
                Settings
              </Sidebar.Item>
            </Sidebar.ItemGroup>
          </div>
        </Sidebar>
      </div>
      <div className="main pl-[48px] h-full w-full flex">
        <Outlet />
      </div>
    </Flowbite>
  );
};
