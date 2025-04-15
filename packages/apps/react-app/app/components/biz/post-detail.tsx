import React from 'react';
import { Clock, Pencil, Trash2, User, Bookmark } from 'lucide-react';

import { Card } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Tiptap } from '~/components/tiptap/editor';

import { formatDateTime } from '~/lib/utils';

import type { Post } from '~/types';

interface PostDetailProps {
  post: Post;
  isOwner?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const PostDetail: React.FC<PostDetailProps> = ({ post, isOwner, onEdit, onDelete }) => {
  return (
    <Card className="p-4">
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-4">
          <h2 className="text-3xl font-bold">{post.title}</h2>
          <div className="flex items-center space-x-4 text-muted-foreground">
            <div className="flex items-center">
              <Bookmark className="w-4 h-4 mr-1" />
              <span>{post.category_name}</span>
            </div>

            <div className="flex items-center">
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
          <div className="flex space-x-2">
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

      <div className="flex flex-wrap gap-2 mb-4">
        {post.tags.map((tag) => (
          <Badge key={tag} variant="secondary">
            {tag}
          </Badge>
        ))}
      </div>

      <Tiptap content={post.content} editable={false} />
    </Card>
  );
};

export default PostDetail;
