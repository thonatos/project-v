import React, { Suspense } from 'react';
import { Await } from 'react-router';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { StrategyList } from './strategy-list';
import { StrategySkeleton } from '~/components/biz/strategy-skeleton';

export const StrategyCard: React.FC<{}> = () => {
  return (
    <Card className="overflow-hidden py-0 gap-0">
      <CardHeader className="py-4 bg-muted/50">
        <CardTitle>Strategy</CardTitle>
        <CardDescription>Stock and cryptocurrency trading strategies.</CardDescription>
      </CardHeader>
      <CardContent className="px-6 py-4">
        <Suspense fallback={<StrategySkeleton />}>
          <StrategyList />
        </Suspense>
      </CardContent>
    </Card>
  );
};

export default StrategyCard;
