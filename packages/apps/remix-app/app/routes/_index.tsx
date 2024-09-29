import React from 'react';
import { Link, useLoaderData } from '@remix-run/react';
import { json } from '@vercel/remix';
import type { MetaFunction, LoaderFunctionArgs } from '@vercel/remix';

import { PostCard } from '~/components/biz/post-card';
import { api, Post } from '~/model/ghost';

export const meta: MetaFunction = () => {
  return [{ title: 'Home' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

export const handle = {
  breadcrumb: () => <Link to="/">Home</Link>,
};

export const loader = async (_params: LoaderFunctionArgs) => {
  const posts = await api.posts
    .browse({
      limit: 15,
      filter: 'featured:true+visibility:public',
    })
    .fields({
      id: true,
      slug: true,
      title: true,
      feature_image: true,
      published_at: true,
      excerpt: true,
    })
    .fetch();

  return json({
    posts: posts.success ? (posts.data as Post[]) : [],
  });
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
