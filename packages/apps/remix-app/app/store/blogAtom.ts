import debug from 'debug';
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

import { POST_TAGS, POST_CONTENT } from '~/constants';
import { craeteOrUpdatePost, deletePost, listCategory } from './service/supabase';
import { Category, Post } from '~/types';

export const logger = debug('store:blogAtom');

const defaultPost = {
  title: '',
  content: POST_CONTENT,
  tags: [POST_TAGS[0]],
};

export const tagsAtom = atom<string[]>(POST_TAGS);
export const postAtom = atom<Post>(defaultPost);
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

export const resetPostAtom = atom(null, async (_get, set) => {
  set(postAtom, defaultPost);
});

export const deletePostAtom = atom(null, async (_get, _set, id: string) => {
  logger('delete post', id);
  try {
    const { status, error } = await deletePost(id);
    logger('delete post success', status, error);
    return {
      status,
      error,
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
