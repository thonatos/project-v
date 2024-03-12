import React from 'react';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';

import type { MetaFunction } from '@vercel/remix';
import type { LoaderFunctionArgs } from '@remix-run/node';

import { api, Post } from '~/model/ghost';
import { List } from '~/components/Post/List';

export const meta: MetaFunction = () => {
  return [
    { title: 'Docs - ρV' },
    {
      name: 'description',
      content: 'undefined project - ρV',
    },
  ];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const tag = url.searchParams.get('tag') || '';

  const response = await api.posts
    .browse({
      limit: 15,
      filter: tag ? `visibility:public+tags:${tag}` : 'visibility:public',
    })
    .fields({
      id: true,
      title: true,
      slug: true,
      published_at: true,
      reading_time: true,
    })
    .fetch();

  if (!response.success) {
    throw new Error(response.errors.join(', '));
  }

  return json({ posts: response.data as Post[] });
};

const DocIndex: React.FC = () => {
  const { posts } = useLoaderData<typeof loader>();

  return (
    <div className="docs-index">
      <div className="docs-header border-b border-gray-100 pb-4">
        <h1>Docs</h1>
      </div>
      <div className="docs-content py-4">
        <List posts={posts} />
      </div>
    </div>
  );
};

export default DocIndex;
