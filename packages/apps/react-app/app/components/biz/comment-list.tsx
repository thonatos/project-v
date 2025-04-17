import React, { useState } from 'react';
import { useAtomValue } from 'jotai';
import { User, Clock, Delete } from 'lucide-react';

import { formatDateTime } from '~/lib/utils';
import { Card } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { CommentReply } from './comment-reply';
import { Separator } from '~/components/ui/separator';
import { profileAtom } from '~/store/authAtom';

import type { Comment } from '~/types';

interface CommentListProps {
  comments: Comment[];
  onDelete?: (id: string) => void;
  onReply?: (parentId: string) => void;
}

const CommentItem: React.FC<{
  comment: Comment;
  level?: number;
  onDelete?: (id: string) => void;
  onReply?: (parentId: string) => void;
}> = ({ comment, level = 0, onDelete, onReply }) => {
  const profile = useAtomValue(profileAtom);
  const isOwner = profile?.id === comment.user_id;
  const [isReplying, setIsReplying] = useState(false);

  return (
    <div className="space-y-4" style={{ marginLeft: `${level * 32}px` }}>
      <Card className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center space-x-4 text-muted-foreground">
            <div className="flex items-center">
              <User className="w-4 h-4 mr-1" />
              <span>{comment.user_email}</span>
            </div>
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              <span>
                {formatDateTime('en-US', comment.created_at, {
                  year: 'numeric',
                  month: 'numeric',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: 'numeric',
                })}
              </span>
            </div>
          </div>

          <div className="flex space-x-2">
            {isOwner && onDelete && (
              <Button variant="destructive" size="sm" onClick={() => onDelete(comment.id)}>
                <Delete className="w-4 h-4 mr-1" />
                删除
              </Button>
            )}
            {profile && onReply && (
              <Button variant="outline" size="sm" onClick={() => setIsReplying(true)}>
                回复
              </Button>
            )}
          </div>
        </div>

        <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
      </Card>

      {isReplying && (
        <CommentReply
          postId={comment.post_id}
          parentId={comment.id}
          onSuccess={() => onReply?.(comment.id)}
          onCancel={() => setIsReplying(false)}
        />
      )}

      {comment.replies?.map((reply) => (
        <CommentItem key={reply.id} comment={reply} level={level + 1} onDelete={onDelete} onReply={onReply} />
      ))}
    </div>
  );
};

export const CommentList: React.FC<CommentListProps> = ({ comments, onDelete, onReply }) => {
  const formattedComments = React.useMemo(() => {
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];

    // First pass: Create a map of all comments
    comments.forEach((comment) => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: Organize comments into a tree structure
    comments.forEach((comment) => {
      const formattedComment = commentMap.get(comment.id)!;
      if (comment.parent_id) {
        const parentComment = commentMap.get(comment.parent_id);
        if (parentComment) {
          if (!parentComment.replies) {
            parentComment.replies = [];
          }
          parentComment.replies.push(formattedComment);
        }
      } else {
        rootComments.push(formattedComment);
      }
    });

    return rootComments;
  }, [comments]);

  if (comments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Separator className="my-6" />
      <h3 className="text-lg font-semibold">评论 ({comments.length})</h3>
      <div className="space-y-6">
        {formattedComments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} onDelete={onDelete} onReply={onReply} />
        ))}
      </div>
    </div>
  );
};

export default CommentList;
