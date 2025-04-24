import React, { Suspense } from 'react';
import { Skeleton } from '~/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { StrategyList } from './strategy-list';

export const StrategySkeleton: React.FC<{}> = () => {
  return (
    <div className="grid grid-cols-1 gap-8 py-4">
      <div className="grid gap-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>

      <div className="grid gap-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>

      <div className="grid gap-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
};

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
