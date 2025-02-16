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
  email: string;
  user_metadata: {
    user_name: string;
    full_name: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
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
  except?: string;
  tags: string[];

  user_id?: string;
  user_email?: string;

  category_id?: string;
  category_name?: string;

  feature_image?: string;

  created_at?: number;
  updated_at?: number;
}
