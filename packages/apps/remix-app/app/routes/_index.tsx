import React from 'react';
import { Link, useLoaderData } from '@remix-run/react';
import type { MetaFunction, LoaderFunctionArgs } from '@vercel/remix';

import { PostCard } from '~/components/biz/post-card';
import { listPost } from '~/ghost-module/';

export const handle = {
  breadcrumb: () => <Link to="/">Home</Link>,
};

export const meta: MetaFunction = () => {
  return [{ title: 'Home' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

export const loader = async (_params: LoaderFunctionArgs) => {
  const posts = await listPost({ limit: 15 });
  return {
    posts,
  };
};

const IndexPage: React.FC<{}> = () => {
  const { posts } = useLoaderData<typeof loader>();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {posts.map((post) => (
        <PostCard key={post.id} {...post} />
      ))}
    </div>
  );
};

export default IndexPage;
