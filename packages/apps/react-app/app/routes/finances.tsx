import React from 'react';
import { Link } from 'react-router';
import type { Route } from './+types/finances';

import { StrategyCard } from '~/components/biz/strategy-card';

export const handle = {
  breadcrumb: () => <Link to="/finances">Finances</Link>,
};

export const meta = ({}: Route.MetaArgs) => {
  return [{ title: 'Finances' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

export const FinancesPage: React.FC<{}> = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StrategyCard />
    </div>
  );
};

export default FinancesPage;
