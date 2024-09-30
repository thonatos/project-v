import React, { Suspense } from 'react';
import invariant from 'tiny-invariant';
import { Link } from '@remix-run/react';
import { defer } from '@vercel/remix';
import { Await, useLoaderData } from '@remix-run/react';

import type { MetaFunction, LoaderFunctionArgs } from '@vercel/remix';

import { getPost, Post } from '~/model/ghost';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { formatDateTime } from '~/lib/utils';

export const handle = {
  breadcrumb: () => <Link to="/">Home</Link>,
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const title = data?.post.title || 'Post';
  return [{ title: `${title} - ρV` }, { name: 'description', content: 'undefined project - ρV' }];
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  invariant(params.slug, 'Missing slug param');
  const post = await getPost(params.slug);
  return defer({ post });
};

const PostDetailPage: React.FC<{}> = () => {
  const { post } = useLoaderData<{ post: Post }>();

  return (
    <Card className="max-w-full overflow-hidden">
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
          <Await resolve={post}>
            {(post) => {
              return (
                <div className="post-content py-0">
                  {post.html && (
                    <div
                      className="gh-content typo text-base tracking-wide break-words"
                      dangerouslySetInnerHTML={{ __html: post.html }}
                    />
                  )}
                </div>
              );
            }}
          </Await>
        </Suspense>
      </CardContent>
    </Card>
  );
};

export default PostDetailPage;
