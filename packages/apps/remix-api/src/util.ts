import { Context } from 'hono';
import { getSignedCookie, setSignedCookie, deleteCookie } from 'hono/cookie';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

import type { CookieOptions } from 'hono/utils/cookie';

export const getUserId = async (c: Context) => {
  const cookieSecret = c.env.AUTH_COOKIE_SRCRET || 'secret';
  const user_id = await getSignedCookie(c, cookieSecret, 'remix_user_id');
  return user_id;
};

export const setUserId = async (c: Context, userId: string) => {
  const secret = c.env.AUTH_COOKIE_SRCRET || 'secret';
  const domain = c.env.AUTH_COOKIE_DOMAIN || 'localhost';

  const options: CookieOptions = {
    path: '/',
    secure: true,
    domain,
    // httpOnly: true,
    sameSite: 'Strict',
    maxAge: 3600,
    expires: dayjs().utc().add(1, 'h').toDate(),
  };

  await setSignedCookie(c, 'remix_user_id', userId, secret, options);
};

export const removeUserId = async (c: Context) => {
  const referer = c.req.header('Referer') || 'localhost';
  const domain = c.env.AUTH_COOKIE_DOMAIN || 'localhost';

  deleteCookie(c, 'remix_user_id', {
    path: '/',
    secure: true,
    domain,
    // httpOnly: true,
    sameSite: 'Strict',
  });
};
