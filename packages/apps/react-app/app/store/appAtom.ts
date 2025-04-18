import debug from 'debug';
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { listConf } from '~/service/conf';

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

export const THEME = {
  DARK: 'dark',
  LIGHT: 'light',
};

export const logger = debug('store:appAtom');

export const searchAtom = atom<string>('');
export const loadingAtom = atom<boolean>(false);
export const referralLinksAtom = atom<ReferralLink[]>([]);
export const sponsorAccountsAtom = atom<SponsorAccounts[]>([]);

export const strategiesAtom = atomWithStorage<Strategy[]>('remix_app_strategy', [], undefined, {
  getOnInit: true,
});

export const themeAtom = atomWithStorage<string | undefined>('remix_app_theme', 'light', undefined, {
  getOnInit: true,
});

export const loadConfAtom = atom(null, async (get, set) => {
  try {
    if (get(loadingAtom)) {
      return;
    }

    set(loadingAtom, true);
    const { data } = await listConf();
    logger('appAtom:conf', data);
    set(strategiesAtom, data.strategies);
    set(referralLinksAtom, data.referral_links);
    set(sponsorAccountsAtom, data.sponsor_accounts);
  } catch (error) {
    logger('appAtom:conf:error', error);
  } finally {
    set(loadingAtom, false);
  }
});
