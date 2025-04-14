import { useEffect, useRef } from 'react';

export function useServiceWorker() {
  const ref = useRef<ServiceWorkerContainer>(undefined);

  useEffect(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      ref.current = navigator.serviceWorker;
    }

    return () => {
      ref.current = undefined;
    };
  }, []);

  return {
    sw: ref.current,
  };
}
