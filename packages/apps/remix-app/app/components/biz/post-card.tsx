import React, { Suspense } from 'react';
import { Await, Link, useAsyncValue } from '@remix-run/react';

import { Skeleton } from '~/components/ui/skeleton';
import { Card, CardContent, CardFooter, CardHeader } from '~/components/ui/card';

import { Post } from '~/model/ghost';
import { formatDateTime, formatReadTime } from '~/lib/utils';

const Image = React.lazy(() => import('~/components/custom/image'));

export const PostCard: React.FC<Post> = ({ title, feature_image, published_at, reading_time, slug }) => {
  const postLink = `/post/${slug}`;

  return (
    <Card>
      <CardHeader className="p-0">
        <Suspense
          fallback={
            <Skeleton
              className="h-36 md:h-48 w-full rounded-xl"
              style={{
                marginTop: 0,
              }}
            />
          }
        >
          <Await resolve={feature_image}>
            {(feature_image) => (
              <Image src={feature_image} className="object-cover h-36 md:h-48 w-full rounded-xl" />
            )}
          </Await>
        </Suspense>
      </CardHeader>
      <CardContent className="p-2">
        <div className="p-2">
          <Link to={postLink}>{title}</Link>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between bg-muted/50 py-2">
        <div className="text-xs text-muted-foreground">{formatDateTime('en-US', published_at)}</div>
        <div className="text-sm text-muted-foreground">{formatReadTime(reading_time)}</div>
      </CardFooter>
    </Card>
  );
};

export default PostCard;
