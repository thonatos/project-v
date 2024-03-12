import React from 'react';
import { Link } from '@remix-run/react';

import { Post } from '~/model/ghost';
import { formatDateTime, formatReadTime } from '~/util';

export const List: React.FC<{
  posts: Post[];
}> = ({ posts }) => {
  return (
    <div className="flex flex-col divide-y">
      {posts.map((post) => {
        const { id, slug, title } = post;
        return (
          <Link to={`/docs/${slug}`} key={id}>
            <div className="flex flex-row justify-between items-center py-3">
              <div className="flex align-middle justify-center items-center">
                <div className="text-sm text-green-600 w-32 uppercase">
                  {formatDateTime('en-US', post.published_at)}
                </div>
                <div>{title}</div>
              </div>
              <div className="text-sm text-gray-500">{formatReadTime(post.reading_time)}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
};
