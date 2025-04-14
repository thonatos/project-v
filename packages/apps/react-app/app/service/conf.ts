import { REMIX_WORKER_URL } from '~/constants';

export const listConf = async () => {
  const res = await fetch(`${REMIX_WORKER_URL}/conf`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  return data;
};
