import React, { Suspense } from 'react';
import { Await, Link } from 'react-router';
import { AsyncImage } from 'loadable-image';
import { Badge } from '~/components/ui/badge';
import { Skeleton } from '~/components/ui/skeleton';
import { Card, CardContent, CardFooter, CardHeader } from '~/components/ui/card';

import { formatDateTime } from '~/lib/utils';
import type { Post } from '~/types';

const ImagePlaceholder = () => (
  <Skeleton
    className="h-36 md:h-48 w-full rounded-xl"
    style={{
      marginTop: 0,
    }}
  />
);

export const PostCard: React.FC<Post> = ({ id, title, tags, except, feature_image, updated_at }) => {
  const postLink = `/post/${id}`;

  return (
    <Card className="overflow-hidden py-0 justify-between gap-2">
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
        <div>
          <Link to={postLink}>{title}</Link>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between bg-muted/50 py-2 px-2">
        <div className="text-xs text-muted-foreground">
          {updated_at && formatDateTime('en-US', updated_at)}
        </div>
        <div className="text-sm text-muted-foreground space-x-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </CardFooter>
    </Card>
  );
};

export default PostCard;
