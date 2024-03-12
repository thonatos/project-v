import React, { FC } from 'react';
import { Card } from 'flowbite-react';
import type { CustomFlowbiteTheme } from 'flowbite-react';

const customTheme: CustomFlowbiteTheme['card'] = {
  root: {
    // children: 'flex h-full flex-col justify-center gap-4 p-6',
    children: 'flex h-full flex-col justify-center gap-4',
  },
};

export const FullCard: FC<React.PropsWithChildren> = ({ children }) => {
  return <Card theme={customTheme}>{children}</Card>;
};
