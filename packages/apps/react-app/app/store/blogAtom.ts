import debug from 'debug';
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { craeteOrUpdatePost, deletePost, listCategory, createComment, deleteComment } from '~/service/blog';
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

const defaultPost = {
  title: '',
  content: defaultContent,
  excerpt: '',
  tags: [defaultTags[0]],
};

export const tagsAtom = atom<string[]>(defaultTags);
export const postAtom = atomWithStorage<Post>('remix_blog_post', defaultPost, undefined, {
  getOnInit: true,
});

export const submittingAtom = atom<boolean>(false);
export const categoriesAtom = atomWithStorage<Category[]>('remix_blog_categories', [], undefined, {
  getOnInit: true,
});

export const ListCategoryAtom = atom(null, async (_get, set) => {
  try {
    const { data, error } = await listCategory();
    logger('list category', data, error);
    set(categoriesAtom, data);
  } catch (error) {
    logger('list category error', error);
  }
});

export const updatePostAtom = atom(null, async (get, set, post: Post) => {
  logger('update post', post);
  set(postAtom, {
    id: post.id,
    title: post.title,
    content: post.content,
    excerpt: post.excerpt,
    tags: post.tags,
    category_name: post.category_name,
  });
});

export const resetPostAtom = atom(null, async (_get, set) => {
  set(postAtom, defaultPost);
});

export const deletePostAtom = atom(null, async (_get, _set, id: string) => {
  logger('delete post', id);
  try {
    const { data } = await deletePost(id);
    logger('delete post success', data);
    return {
      data,
    };
  } catch (error) {
    logger('delete post error', error);
    return {
      error,
    };
  }
});

export const publishPostAtom = atom(null, async (get, set) => {
  const post = get(postAtom);
  const categories = get(categoriesAtom);

  const { category_name, ...rest } = post;
  const category = categories.find((c) => c.name === category_name);

  if (!post.title.trim() || !post.content.trim() || !category) {
    logger('post is invalid');
    return;
  }

  const postData = {
    ...rest,
    category_id: category?.id,
  };

  logger('publish post', postData);

  try {
    set(submittingAtom, true);
    const { data, error } = await craeteOrUpdatePost(postData);
    logger('publish post success', data, error);
    return {
      data,
      error,
    };
  } catch (error) {
    logger('publish post error', error);
    return {
      error,
    };
  } finally {
    set(submittingAtom, false);
  }
});

export const createCommentAtom = atom(
  null,
  async (get, set, { content, postId, parentId }: { content: string; postId: string; parentId?: string }) => {
    return await createComment({ content, postId, parentId });
  }
);

export const deleteCommentAtom = atom(null, async (get, set, id: string) => {
  return await deleteComment(id);
});
