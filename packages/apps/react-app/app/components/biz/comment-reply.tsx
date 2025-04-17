import React from 'react';
import { CommentForm } from './comment-form';

interface CommentReplyProps {
  postId: string;
  parentId: string;
  onCancel: () => void;
  onSuccess?: () => void;
}

export const CommentReply: React.FC<CommentReplyProps> = ({ postId, parentId, onSuccess, onCancel }) => {
  return (
    <div className="mt-4">
      <CommentForm
        postId={postId}
        parentId={parentId}
        onSuccess={() => {
          onSuccess?.();
          onCancel();
        }}
        onCancel={onCancel}
      />
    </div>
  );
};

export default CommentReply;
