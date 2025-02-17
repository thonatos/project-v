import React from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';

export const PostCardSkeleton: React.FC<{}> = () => {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-0">
        <Skeleton
          className="h-36 md:h-48 w-full rounded-xl"
          style={{
            marginTop: 0,
          }}
        />
      </CardHeader>

      <CardContent className="p-2">
        <Skeleton className="h-6 w-full" />
      </CardContent>

      <CardFooter className="flex justify-between bg-muted/50 p-2">
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-6 w-2/4" />
      </CardFooter>
    </Card>
  );
};

export default PostCardSkeleton;
