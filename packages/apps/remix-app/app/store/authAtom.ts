import debug from 'debug';
import { atom } from 'jotai';
import { getProfile } from './service/supabase';

import type { Profile } from '~/types';

const logger = debug('app:store:authAtom');

export const profileAtom = atom<Profile>();

export const loadProfileAtom = atom(null, async (_get, set) => {
  try {
    const { data } = await getProfile();
    logger('loadProfileAtom', data);

    set(profileAtom, data);
  } catch (error) {
    logger('error', error);
  }
});
