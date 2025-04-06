import { atom } from 'jotai';
import { createComment, deleteComment } from './service/supabase';

export const createCommentAtom = atom(
  null,
  async (get, set, { content, postId, parentId }: { content: string; postId: string; parentId?: string }) => {
    return await createComment({ content, postId, parentId });
  }
);

export const deleteCommentAtom = atom(null, async (get, set, id: string) => {
  return await deleteComment(id);
});
