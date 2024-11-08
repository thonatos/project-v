import React, { Suspense } from 'react';
import { Link, Await, useAsyncValue } from '@remix-run/react';
import type { MetaFunction } from '@vercel/remix';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { StrategyList } from '~/components/biz/strategy-list';
import { StrategySkeleton } from '~/components/biz/strategy-skeleton';

export const handle = {
  breadcrumb: () => <Link to="/analytics">Analytics</Link>,
};

export const meta: MetaFunction = () => {
  return [{ title: 'Analytics' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

export const AnalyticsPage: React.FC<{}> = () => {
  const value = useAsyncValue();
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="bg-muted/50">
          <CardTitle>Strategy</CardTitle>
          <CardDescription>Stock and cryptocurrency trading strategies.</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <Suspense fallback={<StrategySkeleton />}>
            <Await resolve={value}>
              <StrategyList />
            </Await>
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsPage;
