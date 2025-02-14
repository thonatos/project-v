import React from 'react';
import { Link } from '@remix-run/react';
import type { MetaFunction } from '@vercel/remix';

import { OSS_PROJECTS } from '~/constants';
import { LinkList } from '~/components/biz/link-list';
import { StrategyCard } from '~/components/biz/strategy-card';

export const handle = {
  breadcrumb: () => <Link to="/finances">Finances</Link>,
};

export const meta: MetaFunction = () => {
  return [{ title: 'Finances' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

export const FinancesPage: React.FC<{}> = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <StrategyCard />

      <LinkList projects={OSS_PROJECTS} />
    </div>
  );
};

export default FinancesPage;
