import debug from 'debug';
import { atom } from 'jotai';

import { POST_TAGS } from '~/constants';
import { craeteOrUpdatePost, listCategory } from './service/supabase';
import { Category, Post } from '~/types';

export const logger = debug('store:blogAtom');

export const tagsAtom = atom<string[]>(POST_TAGS);
export const postAtom = atom<Post>({
  title: '',
  content: '',
  tags: [POST_TAGS[0]],
});
export const submittingAtom = atom<boolean>(false);
export const categoriesAtom = atom<Category[]>([]);

export const ListCategoryAtom = atom(null, async (get, set) => {
  try {
    const { data } = await listCategory();
    logger('list category', data);
    set(categoriesAtom, data);
  } catch (error) {
    logger('list category error', error);
  }
});

export const publishPostAtom = atom(null, async (get, set) => {
  const post = get(postAtom);
  const categories = get(categoriesAtom);

  const { category: categoryName, ...rest } = post;
  const category = categories.find((c) => c.name === categoryName);

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
    const data = await craeteOrUpdatePost(postData);
    logger('publish post success', data);
  } catch (error) {
    logger('publish post error', error);
  } finally {
    set(submittingAtom, false);
  }
});
