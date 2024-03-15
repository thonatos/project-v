import type { CustomFlowbiteTheme } from 'flowbite-react';

const sidebarTheme: CustomFlowbiteTheme['sidebar'] = {
  root: {
    base: 'h-full',
    collapsed: {
      on: 'w-12',
      off: 'w-36',
    },
    inner:
      'h-full overflow-y-auto overflow-x-hidden rounded-r-lg bg-gray-50 py-2 px-1 dark:bg-gray-800 flex flex-col justify-between',
  },
};

export const customTheme: CustomFlowbiteTheme = {
  sidebar: sidebarTheme,
};
