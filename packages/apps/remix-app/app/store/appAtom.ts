import debug from 'debug';
import { atom } from 'jotai';

import { GRAPHQL_API_HASURA } from '~/constants';
import { ReferralLink, SponsorAccounts, Strategy } from '~/types';
import { queryAppConfig } from './service/hasura';

export const logger = debug('store:appAtom');

export const searchAtom = atom<string>('');
export const loadingAtom = atom<boolean>(false);
export const strategiesAtom = atom<Strategy[]>([]);
export const referralLinksAtom = atom<ReferralLink[]>([]);
export const sponsorAccountsAtom = atom<SponsorAccounts[]>([]);

export const appAtom = atom(
  async (get) => {
    return {
      strategies: get(strategiesAtom),
      referralLinks: get(referralLinksAtom),
      sponsorAccounts: get(sponsorAccountsAtom),
    };
  },
  async (_get, set) => {
    try {
      const params: any = {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(queryAppConfig),
      };

      set(loadingAtom, true);

      const res = await fetch(GRAPHQL_API_HASURA, params);
      const { data } = await res.json();
      logger('appAtom:data', data);

      set(strategiesAtom, data.strategies);
      set(referralLinksAtom, data.referral_links);
      set(sponsorAccountsAtom, data.sponsor_accounts);
    } catch (error) {
      logger('appAtom:error', error);
    } finally {
      set(loadingAtom, false);
    }
  }
);
