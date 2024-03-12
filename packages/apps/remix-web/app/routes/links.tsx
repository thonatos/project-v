import React from 'react';
import { Outlet } from '@remix-run/react';

import { Layout } from '~/components/Layout';

const LinkPage: React.FC = () => {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

export default LinkPage;
