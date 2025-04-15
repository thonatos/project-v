import debug from 'debug';
import { client } from '@passwordless-id/webauthn';
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { getProfile, getChallenge, registerPasskey, authenticatePasskey } from '~/service/auth';

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

export const credentialAtom = atomWithStorage<{ id: string } | undefined>(
  'remix_auth_credential',
  undefined,
  undefined,
  {
    getOnInit: true,
  }
);

export const resetProfileAtom = atom(null, (_get, set) => {
  set(tokenAtom, undefined);
  set(profileAtom, undefined);
});

export const loadProfileAtom = atom(null, async (get, set) => {
  try {
    // check if authed with supabase
    const authedWithSupabase = document.cookie.split(';').some((cookie) => {
      const [cookieName] = cookie.split('=');
      return testSupabaseAuth(cookieName);
    });

    // check if authed with our app
    const authedWithRemix = document.cookie.split(';').find((cookie) => {
      const [cookieName] = cookie.split('=');
      return cookieName.trim() === 'remix_user_id';
    });

    const { exp } = get(payloadAtom) || {};
    const isExpired = exp && exp * 1000 < Date.now();
    logger('loadProfileAtom:isExpired', {
      exp,
      now: Date.now(),
      isExpired,
      authed: !authedWithSupabase,
    });

    if (isExpired || (!authedWithSupabase && !authedWithRemix)) {
      set(tokenAtom, undefined);
      set(profileAtom, undefined);
      set(payloadAtom, undefined);
      set(credentialAtom, undefined);
      return;
    }

    if (get(profileAtom)) {
      return;
    }

    logger('loadProfileAtom:fetching profile');
    const { data, token, payload, credential } = await getProfile();
    logger('loadProfileAtom', data, token, payload);

    set(tokenAtom, token);
    set(profileAtom, data);
    set(payloadAtom, payload);
    set(credentialAtom, credential);
  } catch (error) {
    logger('error', error);
  }
});

export const bindPasskeyAtom = atom(null, async (get, set, data: any) => {
  const profile = get(profileAtom);
  if (!profile) return;

  const { data: challenge } = await getChallenge();
  logger('bindPasskeyAtom:challenge', challenge);

  const registration = await client.register({
    user: data.email,
    challenge,
    /* possibly other options */
  });
  logger('bindPasskeyAtom:registration', registration);

  const registrationParsed = await registerPasskey({
    registration,
    challenge,
  });
  logger('bindPasskeyAtom:registrationParsed', registrationParsed);

  // set(profileAtom, { ...profile, [name]: value });
});

export const authPasskeyAtom = atom(null, async (get, set, data?: any) => {
  try {
    const { data: challenge } = await getChallenge();
    logger('authPasskeyAtom:challenge', challenge);

    const authentication = await client.authenticate({
      challenge,
      /* possibly other options */
    });
    logger('authPasskeyAtom:authentication', authentication);

    const res = await authenticatePasskey({
      authentication,
      challenge,
    });

    const authenticationParsed = res?.data?.authenticationParsed;

    logger('authPasskeyAtom:data', authenticationParsed);

    if (authenticationParsed) {
      return authenticationParsed;
    }
  } catch (error) {
    logger('authPasskeyAtom:error', error);
  }
});
