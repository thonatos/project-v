import debug from 'debug';
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { getProfile } from './service/auth';
import type { Profile } from '~/types';

type Payload = Omit<Profile, 'created_at' | 'updated_at'> & { iat: number; exp: number };

const logger = debug('app:store:authAtom');

const testSupabaseAuth = (str: string) => {
  const pattern = /sb-[^-]+-auth-token\.\d+/;
  return pattern.test(str);
};

export const tokenAtom = atomWithStorage<string | undefined>('remix_auth_token', undefined, undefined, {
  getOnInit: true,
});

export const payloadAtom = atomWithStorage<Payload | undefined>('remix_auth_payload', undefined, undefined, {
  getOnInit: true,
});

export const profileAtom = atomWithStorage<Profile | undefined>('remix_auth_profile', undefined, undefined, {
  getOnInit: true,
});

export const resetProfileAtom = atom(null, (_get, set) => {
  set(tokenAtom, undefined);
  set(profileAtom, undefined);
});

export const loadProfileAtom = atom(null, async (get, set) => {
  try {
    // check if authed
    const authed = document.cookie.split(';').some((cookie) => {
      const [cookieName] = cookie.split('=');
      return testSupabaseAuth(cookieName);
    });

    const { exp } = get(payloadAtom) || {};
    const isExpired = exp && exp * 1000 < Date.now();
    logger('loadProfileAtom:isExpired', exp, Date.now(), isExpired);

    if (!authed || isExpired) {
      set(tokenAtom, undefined);
      set(profileAtom, undefined);
      set(payloadAtom, undefined);
      return;
    }

    if (get(profileAtom)) {
      return;
    }

    const { data, token, payload } = await getProfile();
    logger('loadProfileAtom', data, token, payload);

    set(tokenAtom, token);
    set(profileAtom, data);
    set(payloadAtom, payload);
  } catch (error) {
    logger('error', error);
  }
});
