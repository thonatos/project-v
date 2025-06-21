import debug from 'debug';
import { atom } from 'jotai';
import { createCharge } from '~/service/charge';

export const logger = debug('store:chargeAtom');

export const createChargeAtom = atom(null, async (_get, _set, id: string) => {
  logger('create charge', id);
  try {
    const { data } = await createCharge(id);
    logger('create charge success', data);
    return {
      data,
    };
  } catch (error) {
    logger('create charge error', error);
    return {
      error,
    };
  }
});
