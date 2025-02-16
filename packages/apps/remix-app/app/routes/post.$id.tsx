import React, { Suspense } from 'react';
import invariant from 'tiny-invariant';
import { Link } from '@remix-run/react';
import { Await, useLoaderData } from '@remix-run/react';

import type { MetaFunction, LoaderFunctionArgs } from '@vercel/remix';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Tiptap } from '~/components/tiptap/editor';

import { formatDateTime } from '~/lib/utils';
import { createClient } from '~/supabase-module';

export const handle = {
  breadcrumb: () => <Link to="/">Home</Link>,
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const title = data?.data?.title || 'Post';
  return [{ title: `${title} - ρV` }, { name: 'description', content: 'undefined project - ρV' }];
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  invariant(params.id, 'Missing slug param');
  const { supabase } = createClient(request);
  const { data } = await supabase.from('posts').select().eq('id', params.id);

  return {
    data: (data && data[0]) || {},
  };
};

const PostDetailPage: React.FC<{}> = () => {
  const { data } = useLoaderData<typeof loader>();

  return (
    <Card className="max-w-full overflow-hidden">
      <CardHeader className="bg-muted/50">
        <CardTitle>{data.title}</CardTitle>
        <CardDescription>
          {formatDateTime('en-US', data.updated_at, {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<div>loading</div>}>
          <Await resolve={data}>
            {(post) => {
              return <Tiptap content={post.content} editable={false} />;
            }}
          </Await>
        </Suspense>
      </CardContent>
    </Card>
  );
};

export default PostDetailPage;
