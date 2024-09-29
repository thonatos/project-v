import React, { Suspense } from 'react';
import invariant from 'tiny-invariant';
import { Link } from '@remix-run/react';
import { json } from '@vercel/remix';
import { useLoaderData } from '@remix-run/react';

import type { MetaFunction, LoaderFunctionArgs } from '@vercel/remix';

import { api, Post } from '~/model/ghost';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { formatDateTime } from '~/lib/utils';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const title = data?.post.title || 'Post';
  return [{ title: `${title} - ρV` }, { name: 'description', content: 'undefined project - ρV' }];
};

export const handle = {
  breadcrumb: () => <Link to="/">Home</Link>,
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  invariant(params.slug, 'Missing slug param');

  const response = await api.posts
    .read({
      slug: params.slug,
    })
    .fields({
      id: true,
      html: true,
      title: true,
      feature_image: true,
      published_at: true,
    })
    .fetch();
  if (!response.success) {
    throw new Error(response.errors.join(', '));
  }

  return json({ post: response.data as Post });
};

const PostDetailPage: React.FC<{}> = () => {
  const { post } = useLoaderData<typeof loader>();

  return (
    <Card>
      <CardHeader className="bg-muted/50">
        <CardTitle>{post.title}</CardTitle>
        <CardDescription>
          {formatDateTime('en-US', post.published_at, {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<div>loading</div>}>
          <div className="post-content py-0">
            {post.html && (
              <div
                className="gh-content typo text-base tracking-wide break-words"
                dangerouslySetInnerHTML={{ __html: post.html }}
              />
            )}
          </div>
        </Suspense>
      </CardContent>
    </Card>
  );
};

export default PostDetailPage;
