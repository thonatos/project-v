import { createThemeSessionResolver } from 'remix-themes';
import { createCookieSessionStorage } from '@vercel/remix';
import { SITE_DOMAIN } from './constants';

// You can default to 'development' if process.env.NODE_ENV is not set
const isProduction = process.env.NODE_ENV === 'production';

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: 'theme',
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secrets: ['s3cr3t'],
    ...(isProduction ? { domain: SITE_DOMAIN, secure: true } : {}),
  },
});

export const themeSessionResolver = createThemeSessionResolver(sessionStorage);