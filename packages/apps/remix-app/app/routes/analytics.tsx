import React, { Suspense } from 'react';
import { Link } from '@remix-run/react';
import type { MetaFunction } from '@remix-run/cloudflare';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { StrategyList } from '~/components/biz/strategy-list';
import { StrategySkeleton } from '~/components/biz/strategy-skeleton';

export const meta: MetaFunction = () => {
  return [{ title: 'Analytics' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

export const handle = {
  breadcrumb: () => <Link to="/analytics">Analytics</Link>,
};

export const AnalyticsPage: React.FC<{}> = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="bg-muted/50">
          <CardTitle>Strategy</CardTitle>
          <CardDescription>trading strategies</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<StrategySkeleton />}>
            <StrategyList />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsPage;
