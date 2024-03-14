import React from 'react';
import { Sidebar, DarkThemeToggle, Flowbite, Button } from 'flowbite-react';
import {
  HiArrowSmRight,
  HiChartPie,
  HiInbox,
  HiShoppingBag,
  HiTable,
  HiUser,
  HiViewBoards,
} from 'react-icons/hi';

export const Layout: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  return (
    <Flowbite>
      <div className="flex flex-row gap-2">
        <div className="fixed top-0 left-0 h-screen">
          <Sidebar aria-label="sidebar" collapsed={true}>
            <Sidebar.Items>
              <Sidebar.ItemGroup>
                <Sidebar.Item href="#" icon={HiViewBoards} label="Pro" labelColor="dark">
                  Kanban
                </Sidebar.Item>
                <Sidebar.Item href="#" icon={HiUser}>
                  User
                </Sidebar.Item>
                <Sidebar.Item href="#" icon={HiTable}>
                  Sign Up
                </Sidebar.Item>
              </Sidebar.ItemGroup>
              <Sidebar.ItemGroup>
                <div>
                  <DarkThemeToggle />
                </div>
              </Sidebar.ItemGroup>
            </Sidebar.Items>
          </Sidebar>
        </div>
        <div className="flex-1">{children}</div>
      </div>
    </Flowbite>
  );
};
