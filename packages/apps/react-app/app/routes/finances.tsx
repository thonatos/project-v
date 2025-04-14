import { Link } from 'react-router';
import { StrategyCard } from '~/components/biz/strategy-card';
import type { Route } from './+types/finances';

export const handle = {
  breadcrumb: () => <Link to="/finances">Finances</Link>,
};

export const meta = ({}: Route.MetaArgs) => {
  return [{ title: 'Finances' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

export default function ({}: Route.ComponentProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StrategyCard />
    </div>
  );
}
