export const formatDateTime = (locales: string, date?: number | string) => {
  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat(locales, {
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
};

export const formatReadTime = (time?: number | undefined) => {
  const _time = time === 0 ? 1 : Math.ceil(time || 1);
  return `${_time} min read`;
};
