import React, { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { StrategyList } from './strategy-list';
import { StrategySkeleton } from '~/components/biz/strategy-skeleton';

export const StrategyCard: React.FC<{}> = () => {
  return (
    <Card className="overflow-hidden py-0 gap-0">
      <CardHeader className="p-4 bg-muted/50">
        <CardTitle>Strategy</CardTitle>
        <CardDescription>Stock and cryptocurrency trading strategies.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <Suspense fallback={<StrategySkeleton />}>
          <StrategyList />
        </Suspense>
      </CardContent>
    </Card>
  );
};

export default StrategyCard;
