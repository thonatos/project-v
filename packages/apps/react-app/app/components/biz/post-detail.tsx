import React from 'react';
import { Clock, Pencil, Trash2, User, Bookmark, Terminal } from 'lucide-react';

import { Card } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Tiptap } from '~/components/tiptap/editor';
import { Alert, AlertTitle, AlertDescription } from '~/components/ui/alert';
import { OpenGraph } from './open-graph';
import { formatDateTime } from '~/lib/utils';

import type { Post } from '~/types';

interface PostDetailProps {
  post: Post;
  isOwner?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const PostExcerpt: React.FC<{ content?: string }> = ({ content }) => {
  if (!content) return null;

  return (
    <Alert className="mb-2">
      <Terminal className="size-4" />
      <AlertTitle>Summary:</AlertTitle>
      <AlertDescription>{content}</AlertDescription>
    </Alert>
  );
};

export const PostDetail: React.FC<PostDetailProps> = ({ post, isOwner, onEdit, onDelete }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* content */}
      <div className="col-span-3">
        <Card className="p-4 gap-4">
          <div className="flex justify-between items-start mb-2">
            <div className="space-y-4">
              <h2 className="text-sm md:text-xl font-bold">{post.title}</h2>
              <div className="flex items-center space-x-4 text-muted-foreground">
                <div className="flex items-center">
                  <Bookmark className="w-4 h-4 mr-1" />
                  <span>{post.category_name}</span>
                </div>

                <div className="hidden md:flex items-center">
                  <User className="w-4 h-4 mr-1" />
                  <span>{post.user_email}</span>
                </div>

                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
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
            </div>

            {isOwner && (
              <div className="hidden md:flex space-x-2">
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

          <div className="flex flex-wrap gap-2 mb-2">
            {post.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>

          <PostExcerpt content={post.excerpt} />

          <Tiptap content={post.content} editable={false} />
        </Card>
      </div>

      {/* open graph */}
      <div>
        <OpenGraph title={post.title} description={post.excerpt} />
      </div>
    </div>
  );
};

export default PostDetail;
