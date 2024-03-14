import React from 'react';
import { Sidebar, DarkThemeToggle, Flowbite } from 'flowbite-react';
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
          <Sidebar aria-label="Default sidebar example">
            <Sidebar.Items>
              <Sidebar.ItemGroup>
                <Sidebar.Item href="#" icon={HiChartPie}>
                  Dashboard
                </Sidebar.Item>
                <Sidebar.Item href="#" icon={HiViewBoards} label="Pro" labelColor="dark">
                  Kanban
                </Sidebar.Item>
                <Sidebar.Item href="#" icon={HiInbox} label="3">
                  Inbox
                </Sidebar.Item>
                <Sidebar.Item href="#" icon={HiUser}>
                  Users
                </Sidebar.Item>
                <Sidebar.Item href="#" icon={HiShoppingBag}>
                  Products
                </Sidebar.Item>
                <Sidebar.Item href="#" icon={HiArrowSmRight}>
                  Sign In
                </Sidebar.Item>
                <Sidebar.Item href="#" icon={HiTable}>
                  Sign Up
                </Sidebar.Item>
              </Sidebar.ItemGroup>
            </Sidebar.Items>
          </Sidebar>
        </div>
        <div className="flex-1">
          <DarkThemeToggle />

          {children}
        </div>
      </div>
    </Flowbite>
  );
};
