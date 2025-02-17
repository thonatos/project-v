import debug from 'debug';
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

import { getProfile } from './service/supabase';

import type { Profile } from '~/types';

const logger = debug('app:store:authAtom');

export const profileAtom = atomWithStorage<Profile | undefined>('remix_auth_profile', undefined, undefined, {
  getOnInit: true,
});

export const resetProfileAtom = atom(null, (_get, set) => {
  set(profileAtom, undefined);
});

export const loadProfileAtom = atom(null, async (_get, set) => {
  try {
    const { data } = await getProfile();
    logger('loadProfileAtom', data);

    set(profileAtom, data);
  } catch (error) {
    logger('error', error);
  }
});
