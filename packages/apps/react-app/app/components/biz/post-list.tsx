import React from 'react';
import { PostCard } from './post-card';
import { PostCardSkeleton } from './post-card';

import { type Post } from '~/types';

export const PostList: React.FC<{ data: Post[] }> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-4">
        <PostCardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4">
      {data.map((post) => (
        <PostCard key={post.id} {...post} feature_image={`https://picsum.photos/seed/${post.id}/480/240`} />
      ))}
    </div>
  );
};
