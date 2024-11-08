import { registerSW } from 'virtual:pwa-register';

const intervalMS = 60 * 60 * 1000;

registerSW({
  immediate: true,
  onOfflineReady() {
    console.log('[pwa] pwa ready to work offline');
  },
  onRegisteredSW(swUrl, swReg) {
    console.log('[pwa] sw registered: ', swUrl);

    if (!swReg) {
      return;
    }

    setInterval(async () => {
      if (swReg.installing || !navigator) {
        return;
      }

      if ('connection' in navigator && !navigator.onLine) {
        return;
      }

      const resp = await fetch(swUrl, {
        cache: 'no-store',
        headers: {
          cache: 'no-store',
          'cache-control': 'no-cache',
        },
      });

      if (resp?.status === 200) await swReg.update();
    }, intervalMS);
  },
});
