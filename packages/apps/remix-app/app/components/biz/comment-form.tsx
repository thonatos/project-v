import React from 'react';
import { useSetAtom } from 'jotai';
import { useToast } from '~/hooks/use-toast';

import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import { createCommentAtom } from '~/store/commentAtom';

interface CommentFormProps {
  postId: string;
  parentId?: string;
  onCancel?: () => void;
  onSuccess?: () => void;
}

export const CommentForm: React.FC<CommentFormProps> = ({ postId, parentId, onCancel, onSuccess }) => {
  const { toast } = useToast();
  const createComment = useSetAtom(createCommentAtom);
  const [content, setContent] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      toast({
        title: '请输入评论内容',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { status } = await createComment({ content, postId, parentId });

      if (status === 401) {
        toast({
          title: '请先登录',
          variant: 'destructive',
        });
        return;
      }

      if (status !== 201) {
        toast({
          title: '评论失败',
          description: '请稍后重试',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: '评论成功',
      });

      setContent('');
      onSuccess?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        placeholder="写下你的评论..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
      />
      <div className="flex justify-end space-x-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '提交中...' : parentId ? '回复' : '评论'}
        </Button>
      </div>
    </form>
  );
};

export default CommentForm;
