import React from 'react';
import { Skeleton } from '~/components/ui/skeleton';

export const RepositorySkeleton: React.FC<{}> = () => {
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

export default RepositorySkeleton;
