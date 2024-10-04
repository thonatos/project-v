import { TSGhostContentAPI } from '@ts-ghost/content-api';
import { getValue, setValue } from '~/lib/kv';

export const api = new TSGhostContentAPI(
  process.env.GHOST_URL || '',
  process.env.GHOST_CONTENT_API_KEY || '',
  'v5.70.1'
);

export interface ListPostOptions {
  limit?: number;
}

export const listPost = async (options: ListPostOptions): Promise<Post[]> => {
  const { limit = 15 } = options || {};

  const posts = await api.posts
    .browse({
      limit,
      filter: 'visibility:public', // featured:true+visibility:public
    })
    .fields({
      id: true,
      slug: true,
      title: true,
      feature_image: true,
      published_at: true,
      excerpt: true,
    })
    .fetch();

  return posts.success ? (posts.data as Post[]) : [];
};

export interface GetPostOptions {
  slug: string;
}

export const getPost = async (slug: string): Promise<Post> => {
  const _cache = await getValue(slug);

  if (_cache) {
    console.log('get post from cache:', slug);
    return _cache as Post;
  }

  const response = await api.posts
    .read({
      slug,
    })
    .fields({
      id: true,
      html: true,
      title: true,
      feature_image: true,
      published_at: true,
    })
    .fetch();

  if (!response.success) {
    throw new Error(response.errors.join(', '));
  }

  await setValue(slug, response.data);

  return response.data as Post;
};

export interface Post {
  id: string;
  url: string;
  uuid: string;
  slug: string;
  html: string;
  title: string;
  excerpt?: string;

  reading_time?: number;

  access?: boolean;
  visibility?: string;

  created_at: string;
  updated_at: string;
  published_at: string;

  meta_title?: string;
  meta_description?: string;

  featured?: boolean;
  feature_image?: string;
}

export interface Tag {
  id: string;
  url: string;
  name: string;
  slug: string;
  description?: string;

  visibility?: string;

  meta_title?: string;
  meta_description?: string;

  feature_image?: string;
  count?: {
    posts: number;
  };
}
