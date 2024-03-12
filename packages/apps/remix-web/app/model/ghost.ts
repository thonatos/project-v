import { TSGhostContentAPI } from '@ts-ghost/content-api';

export const api = new TSGhostContentAPI(
  process.env.GHOST_URL || '',
  process.env.GHOST_CONTENT_API_KEY || '',
  'v5.70.1'
);

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
