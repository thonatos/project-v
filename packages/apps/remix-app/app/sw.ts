/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute, Route } from 'workbox-routing';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { StarredRepoMessageHandler } from './github-module/event';

declare const self: ServiceWorkerGlobalScope;

const SW_VERSION = '1.0.0';
const SW_MANIFEST = self.__WB_MANIFEST as Array<any>;
const SW_BUILD_DATE = import.meta.env.VITE_BUILD_DATE;

const API_DOMAINS = ['hasura.implements.io'];
const DEV_DOMAINS = ['localhost', '127.0.0.1'];
const ASSET_DEST_TYPES = ['font', 'image', 'script', 'style'];

self.addEventListener('install', (event) => {
  console.log(`[sw] installed, ${SW_VERSION} - ${SW_BUILD_DATE}`, SW_MANIFEST);
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('[sw] activated');

  // Get all the currently active `Cache` instances.
  const cleanCache = async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((key) => {
        return caches.delete(key);
      })
    );
  };

  // Reload all windows
  const reloadWindow = async () => {
    const windowClients = await self.clients.matchAll({
      type: 'window',
    });

    windowClients.forEach((windowClient) => {
      windowClient.navigate(windowClient.url);
    });
  };

  event.waitUntil(Promise.all([cleanCache(), reloadWindow()]));
});

const starredRepoMessageHandler = new StarredRepoMessageHandler();

self.addEventListener('message', async (event) => {
  console.log('[sw] message: ', event);

  if (event?.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  event.waitUntil(Promise.all([starredRepoMessageHandler.handleMessage(event)]));
});

self.addEventListener('statechange', (event) => {
  console.log('[sw] statechange', event?.target);
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
precacheAndRoute([
  {
    url: '/',
    revision: SW_VERSION,
  },
  {
    url: '/analytics',
    revision: SW_VERSION,
  },
  {
    url: '/projects',
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
