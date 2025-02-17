import debug from 'debug';
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { getProfile } from './service/supabase';
import type { Profile } from '~/types';

const logger = debug('app:store:authAtom');

const testSupabaseAuth = (str: string) => {
  const pattern = /sb-[^-]+-auth-token\.\d+/;
  return pattern.test(str);
};

export const profileAtom = atomWithStorage<Profile | undefined>('remix_auth_profile', undefined, undefined, {
  getOnInit: true,
});

export const resetProfileAtom = atom(null, (_get, set) => {
  set(profileAtom, undefined);
});

export const loadProfileAtom = atom(null, async (get, set) => {
  try {
    const authed = document.cookie.split(';').some((cookie) => {
      const [cookieName] = cookie.split('=');
      return testSupabaseAuth(cookieName);
    });

    if (!authed) {
      set(profileAtom, undefined);
      return;
    }

    if (get(profileAtom)) {
      return;
    }

    const { data } = await getProfile();
    logger('loadProfileAtom', data);

    set(profileAtom, data);
  } catch (error) {
    logger('error', error);
  }
});
