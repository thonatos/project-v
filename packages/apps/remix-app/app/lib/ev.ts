import { logger } from '~/lib/utils';

export const initEventSource = (url: string, onMessage: (data: any) => void) => {
  if (!EventSource) {
    console.error('EventSource is not supported');
    return;
  }

  const eventSource = new EventSource(url);

  eventSource.onopen = () => {
    logger.log('EventSource connected:', url);
  };

  eventSource.onmessage = (event) => {
    onMessage(JSON.parse(event.data));
  };

  eventSource.onerror = (error) => {
    console.error('EventSource error:', error);
  };

  return eventSource;
}
