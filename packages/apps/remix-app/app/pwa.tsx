import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[pwa] pwa need refresh');
    updateSW(true);
  },
  onOfflineReady() {
    console.log('[pwa] pwa ready to work offline');
  },
  onRegisteredSW(swUrl, r) {
    console.log('[pwa] swUrl: ', swUrl, r);

    if (!r?.installing) {
      return;
    }

    r.installing.addEventListener('statechange', (e) => {
      const sw = e.target as ServiceWorker;
      console.log('[pwa] statechange: ', sw.state, sw);
    });
  },
});
