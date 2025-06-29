import React from 'react';
import { Pencil, Trash2, User, Bookmark, Terminal, Calendar } from 'lucide-react';

import { Card } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '~/components/ui/alert';
import { Tiptap } from '~/components/tiptap/editor';
import { formatDateTime } from '~/lib/utils';

import { PostSponsor } from './post-sponsor';

import type { Post } from '~/types';

interface PostDetailProps {
  post: Post;
  isOwner?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const PostSkeleton: React.FC<{}> = () => {
  return (
    <Card className="p-4">
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-4 flex-1">
          <Skeleton className="h-8 w-3/4" />
          <div className="flex items-center space-x-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex space-x-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-24" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-3/6" />
      </div>
    </Card>
  );
};

export const PostExcerpt: React.FC<{ content?: string }> = ({ content }) => {
  if (!content) return null;

  return (
    <Alert className="mb-2">
      <Terminal className="size-4" />
      <AlertTitle>Summary:</AlertTitle>
      <AlertDescription>{content}</AlertDescription>
    </Alert>
  );
};

export const PostPoster: React.FC<{
  post: Post;
}> = ({ post }) => {
  const imageUrl = `https://picsum.photos/seed/${post.id}/2000/300`;

  return (
    <Card className="overflow-hidden py-0">
      <div
        className="relative h-[300px] bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.8)), url(${imageUrl})`,
        }}
      >
        <div className="absolute inset-0 flex flex-col justify-end p-8 text-white">
          <div className="space-y-4">
            <div className="hidden md:flex items-center space-x-4 text-sm">
              <div className="flex items-center">
                <Bookmark className="w-4 h-4 mr-1" />
                <span>{post.category_name}</span>
              </div>

              <div className="flex items-center">
                <User className="w-4 h-4 mr-1" />
                <span>{post.user_email}</span>
              </div>

              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                <span>
                  {formatDateTime('en-US', post?.updated_at || '', {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                  })}
                </span>
              </div>
            </div>

            <h1 className="text-sm md:text-2xl font-bold">{post.title}</h1>

            <p className="text-sm">{post.excerpt}</p>

            <div className="flex items-center space-x-4 pt-4">
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export const PostDetail: React.FC<PostDetailProps> = ({ post, isOwner, onEdit, onDelete }) => {
  return (
    <div className="flex flex-col gap-4">
      {/* actions */}
      <div className="flex item-center justify-between">
        <PostSponsor postId={post.id} />

        {isOwner && (
          <div className="hidden md:flex space-x-2 md:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!onEdit || !post.id) return;
                onEdit(post.id);
              }}
            >
              <Pencil className="w-4 h-4 mr-1" />
              编辑
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (!onDelete || !post.id) return;
                onDelete(post.id);
              }}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              删除
            </Button>
          </div>
        )}
      </div>

      {/* poster */}
      <PostPoster post={post} />

      {/* content */}
      <Card className="p-4 gap-4">
        <PostExcerpt content={post.excerpt} />

        <Tiptap content={post.content} editable={false} />
      </Card>
    </div>
  );
};

export default PostDetail;
