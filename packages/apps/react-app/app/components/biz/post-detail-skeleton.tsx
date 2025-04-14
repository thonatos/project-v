import React from 'react';
import { Card } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';

export const PostDetailSkeleton: React.FC<{}> = () => {
  return (
    <Card className="p-4">
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-4 flex-1">
          <Skeleton className="h-8 w-3/4" />
          <div className="flex items-center space-x-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex space-x-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-24" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-3/6" />
      </div>
    </Card>
  );
};

export default PostDetailSkeleton;
