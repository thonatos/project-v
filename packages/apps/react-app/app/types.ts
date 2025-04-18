export interface Strategy {
  id: number;
  title: string;
  description: string;
  thumb: string;
  url: string;
}

export interface ReferralLink {
  id: number;
  title: string;
  description?: string;
  thumb?: string;
  url: string;
}

export interface SponsorAccounts {
  network: string;
  chain_id: string;
  address: string;
  symbol: string;
  values: string[];
}

export interface Profile {
  id: string;
  role: string;
  name: string;
  email: string;
  avatar_url: string;

  created_at: string;
  updated_at: string;

  bio?: string;
  location?: string;
}

export interface Category {
  id: number;
  name: string;
  type: string;
}

export interface Post {
  id?: string;
  post_id?: string;

  title: string;
  content: string;
  excerpt?: string;
  tags: string[];

  user_id?: string;
  user_email?: string;

  category_id?: string;
  category_name?: string;

  feature_image?: string;

  created_at?: number;
  updated_at?: number;
}

export interface Comment {
  id: string;
  post_id: string;
  parent_id?: string;
  user_id: string;
  user_email: string;
  content: string;
  created_at: string;
  updated_at: string;
  replies?: Comment[];
}

export interface Message {
  role: string;
  content: string;
}
