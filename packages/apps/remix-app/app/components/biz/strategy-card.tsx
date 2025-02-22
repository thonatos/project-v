import React, { Suspense } from 'react';
import { Await, useAsyncValue } from '@remix-run/react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { StrategyList } from './strategy-list';
import { StrategySkeleton } from '~/components/biz/strategy-skeleton';

export const StrategyCard: React.FC<{}> = () => {
  const value = useAsyncValue();

  return (
    <Card>
      <CardHeader className="p-4 bg-muted/50">
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
  );
};

export default StrategyCard;
