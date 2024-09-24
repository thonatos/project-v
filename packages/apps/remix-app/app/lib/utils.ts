import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
};

export const formatDateTime = (locales: string | string[], date: number | string, options?: Intl.DateTimeFormatOptions) => {
  if (!date) {
    return '';
  }

  const _options = options || {
    month: 'long',
    day: 'numeric',
  };

  return new Intl.DateTimeFormat(locales, _options).format(new Date(date));
};

export const formatReadTime = (time?: number | undefined) => {
  const _time = time === 0 ? 1 : Math.ceil(time || 1);
  return `${_time} min read`;
};
