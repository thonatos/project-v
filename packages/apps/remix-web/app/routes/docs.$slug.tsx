import React from 'react';
import invariant from 'tiny-invariant';
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';

import type { MetaFunction } from '@vercel/remix';
import type { LoaderFunctionArgs } from '@remix-run/node';

import { api, Post } from '~/model/ghost';

export const meta: MetaFunction = () => {
  return [
    { title: 'Docs - ρV' },
    {
      name: 'description',
      content: 'undefined project - ρV',
    },
  ];
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
    })
    .fetch();
  if (!response.success) {
    throw new Error(response.errors.join(', '));
  }

  return json({ post: response.data as Post });
};

const DocIndex: React.FC = () => {
  const { post } = useLoaderData<typeof loader>();

  return (
    <div className="docs-page">
      <div className="docs-header border-b border-gray-100 pb-4">
        <h1>{post.title}</h1>
      </div>
      <div className="docs-content py-4">
        {post.html && (
          <div
            className="gh-content typo text-base tracking-wide break-words"
            dangerouslySetInnerHTML={{ __html: post.html }}
          />
        )}
      </div>
    </div>
  );
};

export default DocIndex;
