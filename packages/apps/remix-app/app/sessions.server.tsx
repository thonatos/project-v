import { createThemeSessionResolver } from 'remix-themes';
import { createCookieSessionStorage } from '@vercel/remix';
import { REMIX_WEB_DOMAIN } from './constants';

// You can default to 'development' if process.env.NODE_ENV is not set
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || 's3cr3t';

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: 'theme',
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secrets: [sessionSecret],
    ...(isProduction ? { domain: REMIX_WEB_DOMAIN, secure: true } : {}),
  },
});

export const themeSessionResolver = createThemeSessionResolver(sessionStorage);
