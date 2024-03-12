import React from 'react';
import { Flowbite } from 'flowbite-react';
import { Header } from '~/components/Header';
import { customTheme } from '~/theme';

export const Layout: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  return (
    <Flowbite theme={{ theme: customTheme }}>
      <div className="antialiased bg-gray-50 dark:bg-gray-900">
        <Header />

        <div className="p-4 md:ml-64 h-auto pt-20">
          <div className="container m-auto p-4 my-8 rounded bg-white">{children}</div>
        </div>
      </div>
    </Flowbite>
  );
};
