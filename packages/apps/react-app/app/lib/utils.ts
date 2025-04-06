import debug from "debug";
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export const logger = debug('remix:web');

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void {
  let lastFunc: NodeJS.Timeout | null;
  let lastRan: number | null = null;
  return (...args: Parameters<T>) => {
    if (!lastRan) {
      func(...args);
      lastRan = Date.now();
    } else {
      if (lastFunc) clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if ((Date.now() - (lastRan as number)) >= limit) {
          func(...args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - (lastRan as number)));
    }
  };
}

export const formatDateTime = (locales: string | string[], date: number | string, options?: Intl.DateTimeFormatOptions) => {
  if (!date) {
    return '';
  }

  const _options = options || {
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Hong_Kong',
  };

  return new Intl.DateTimeFormat(locales, _options).format(new Date(date));
};

export const formatReadTime = (time?: number | undefined) => {
  const _time = time === 0 ? 1 : Math.ceil(time || 1);
  return `${_time} min read`;
};

export const sendMessageToSW = (event: string, payload: any) => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {    
    navigator.serviceWorker.controller.postMessage({ type: event, payload });
  }
};
