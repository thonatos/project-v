/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute, Route } from 'workbox-routing';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { StarredRepoMessageHandler } from './github-module/event';

declare const self: ServiceWorkerGlobalScope;

// disable workbox logs
self.__WB_DISABLE_DEV_LOGS = true;

const SW_WB_MANIFEST = self.__WB_MANIFEST || [];
const SW_PERIOD = import.meta.env.DEV ? 0.3 * 60 * 1000 : 5 * 60 * 1000;
const SW_VERSION = import.meta.env.VITE_BUILD_DATE || new Date().toLocaleString();

const API_DOMAINS = ['hasura.implements.io'];
const DEV_DOMAINS = ['localhost', '127.0.0.1'];

const ASSET_DEST_TYPES = ['font', 'image', 'script', 'style'];

const reloadWindow = async () => {
  const windowClients = await self.clients.matchAll({
    type: 'window',
  });

  windowClients.forEach((windowClient) => {
    windowClient.navigate(windowClient.url);
  });
};

const cleanCache = async () => {
  const keys = await caches.keys();
  await Promise.all(
    keys.map((key) => {
      return caches.delete(key);
    })
  );
};

const registerPeriodicSync = (period: number, swUrl: string) => {
  if (period <= 0) {
    return;
  }

  let etag = 'empty';
  console.log('[sw] swUrl:', swUrl);

  setInterval(async () => {
    try {
      const resp = await fetch(swUrl, {
        cache: 'no-store',
        headers: {
          cache: 'no-store',
          'cache-control': 'no-cache',
        },
      });

      const currentTime = new Date().toLocaleString();
      const currentEtag = resp.headers.get('etag') || '';

      if (resp?.status === 200 && etag !== currentEtag) {
        console.log('[sw] sw update at %s, etag: %s, new etag: %s', currentTime, etag, currentEtag);
        await self.registration.update();
        etag = currentEtag;
      }
    } catch (error) {
      console.log('[pwa] check sw update error:', error);
    }
  }, period);
};

self.addEventListener('install', (event) => {
  console.log(`[sw] install: ${SW_VERSION}`, SW_WB_MANIFEST);
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('[sw] activate: activated');

  event.waitUntil(Promise.all([cleanCache(), reloadWindow()]));

  registerPeriodicSync(SW_PERIOD, self.serviceWorker.scriptURL);
});

const starredRepoMessageHandler = new StarredRepoMessageHandler();

self.addEventListener('message', (event) => {
  console.log('[sw] message: ', event);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[sw] message: ', 'SKIP_WAITING');
    self.skipWaiting();
  } else {
    event.waitUntil(Promise.all([starredRepoMessageHandler.handleMessage(event)]));
  }
});

self.addEventListener('statechange', (event: any) => {
  console.log('[sw] statechange: ', event?.target);

  if (event?.target?.state === 'redundant') {
    console.log('[sw] statechange: redundant');
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin === location.origin && url.pathname === '/') {
    event.respondWith(new StaleWhileRevalidate().handle({ event, request }));
  }
});

const assetsRoute = new Route(
  ({ request }) => {
    const _url = new URL(request.url);

    if (DEV_DOMAINS.includes(_url.hostname)) {
      return false;
    }

    return ASSET_DEST_TYPES.includes(request.destination);
  },
  new CacheFirst({
    cacheName: `assets-${SW_VERSION}`,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

const apiRoute = new Route(
  ({ request }) => {
    const _url = new URL(request.url);
    return API_DOMAINS.includes(_url.hostname);
  },
  new StaleWhileRevalidate({
    cacheName: `api-${SW_VERSION}`,
  })
);

// self.__WB_MANIFEST is default injection point
let manifest = SW_WB_MANIFEST || [];
const homePageIndex = manifest.findIndex((item) => {
  if (typeof item === 'string') {
    return item === '/';
  }

  return item.url === '/';
});

if (homePageIndex === -1) {
  manifest.push({
    url: '/',
    revision: SW_VERSION,
  });
}

precacheAndRoute([
  ...manifest,
  {
    url: '/finances',
    revision: SW_VERSION,
  },
  {
    url: '/github/stars',
    revision: SW_VERSION,
  },
  {
    url: '/favicon.ico',
    revision: SW_VERSION,
  },
]);

registerRoute(new NavigationRoute(createHandlerBoundToURL('/')));
registerRoute(apiRoute);
registerRoute(assetsRoute);

// active clients
clientsClaim();

// clean old assets
cleanupOutdatedCaches();
