import debug from 'debug';
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { createOrUpdatePost, deletePost, listCategory, createComment, deleteComment } from '~/service/blog';
import type { Category, Post } from '~/types';

export const logger = debug('store:blogAtom');

const defaultTags = ['Linux', 'MacOS', 'Node.js', 'React.js', 'JavaScript'];
const defaultContent = `
<h2>
  Hi there,
</h2>
<p>
  this is a basic <em>basic</em> example of <strong>Tiptap</strong>. Sure, there are all kind of basic text styles you’d probably expect from a text editor. But wait until you see the lists:
</p>
<ul>
  <li>
    That’s a bullet list with one …
  </li>
  <li>
    … or two list items.
  </li>
</ul>
<p>
  Isn’t that great? And all of that is editable. But wait, there’s more. Let’s try a code block:
</p>
<pre><code class="language-css">body { display: none; }</code></pre>
<p>
  I know, I know, this is impressive. It’s only the tip of the iceberg though. Give it a try and click a little bit around. Don’t forget to check the other examples too.
</p>
<blockquote>
  Wow, that’s amazing. Good work, boy! 👏
  <br />
  — Mom
</blockquote>
`;

const defaultPost: Post = {
  title: '',
  content: defaultContent,
  excerpt: '',
  tags: [defaultTags[0]],
  // 其他 Post 字段可补充默认值
};

export const tagsAtom = atom<string[]>(defaultTags);
export const postAtom = atomWithStorage<Post>('remix_blog_post', defaultPost, undefined, {
  getOnInit: true,
});

export const submittingAtom = atom<boolean>(false);
export const categoriesAtom = atomWithStorage<Category[]>('remix_blog_categories', [], undefined, {
  getOnInit: true,
});

export const listCategoryAtom = atom(null, async (_get, set) => {
  try {
    const { data, error } = await listCategory();
    logger('list category', data, error);
    set(categoriesAtom, data);
    return { data, error };
  } catch (error) {
    logger('list category error', error);
    return { error };
  }
});

export const updatePostAtom = atom(null, async (_get, set, post: Post) => {
  logger('update post', post);
  set(postAtom, {
    ...defaultPost,
    ...post,
  });
});

export const resetPostAtom = atom(null, (_get, set) => {
  set(postAtom, defaultPost);
});

export const deletePostAtom = atom(null, async (_get, _set, id: string) => {
  logger('delete post', id);
  try {
    const { data } = await deletePost(id);
    logger('delete post success', data);
    return { data };
  } catch (error) {
    logger('delete post error', error);
    return { error };
  }
});

export const publishPostAtom = atom(null, async (get, set) => {
  const post = get(postAtom);
  const categories = get(categoriesAtom);

  const { category_name, ...rest } = post;
  const category = categories.find((c) => c.name === category_name);

  if (!post.title?.trim() || !post.content?.trim() || !category) {
    const error = 'Post is invalid: title/content/category required';
    logger('post is invalid', post);
    return { error };
  }

  const postData = {
    ...rest,
    category_id: category.id,
  };

  logger('publish post', postData);

  try {
    set(submittingAtom, true);
    const { data, error } = await createOrUpdatePost(postData);
    logger('publish post success', data, error);
    return { data, error };
  } catch (error) {
    logger('publish post error', error);
    return { error };
  } finally {
    set(submittingAtom, false);
  }
});

export const createCommentAtom = atom(
  null,
  async (
    _get,
    _set,
    { content, postId, parentId }: { content: string; postId: string; parentId?: string }
  ) => {
    try {
      const data = await createComment({ content, postId, parentId });
      return { data };
    } catch (error) {
      logger('create comment error', error);
      return { error };
    }
  }
);

export const deleteCommentAtom = atom(null, async (_get, _set, id: string) => {
  try {
    const data = await deleteComment(id);
    return { data };
  } catch (error) {
    logger('delete comment error', error);
    return { error };
  }
});
