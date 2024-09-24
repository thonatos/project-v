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
