import React, { Suspense } from 'react';
import { Await, Link } from '@remix-run/react';
import { AsyncImage } from 'loadable-image';
import { Skeleton } from '~/components/ui/skeleton';
import { Card, CardContent, CardFooter, CardHeader } from '~/components/ui/card';

import { Post } from '~/model/ghost';
import { formatDateTime, formatReadTime } from '~/lib/utils';

const ImagePlaceholder = () => (
  <Skeleton
    className="h-36 md:h-48 w-full rounded-xl"
    style={{
      marginTop: 0,
    }}
  />
);

export const PostCard: React.FC<Post> = ({ title, feature_image, published_at, reading_time, slug }) => {
  const postLink = `/post/${slug}`;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-0">
        <Suspense fallback={<ImagePlaceholder />}>
          <Await resolve={feature_image}>
            {(feature_image) =>
              feature_image ? (
                <AsyncImage
                  src={feature_image}
                  className="object-cover h-36 md:h-48 w-full rounded-xl"
                  loader={<ImagePlaceholder />}
                />
              ) : (
                <ImagePlaceholder />
              )
            }
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
