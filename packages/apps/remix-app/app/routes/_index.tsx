import type { MetaFunction } from '@remix-run/node';
import { Dashboard } from '~/components/custom/dashboard';

export const meta: MetaFunction = () => {
  return [{ title: 'Remix App' }, { name: 'description', content: 'Welcome to Remix!' }];
};

export default function Index() {
  return <Dashboard />;
}
