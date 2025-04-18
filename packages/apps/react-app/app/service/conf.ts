import { REMIX_API } from '~/constants';

export const listConf = async () => {
  const res = await fetch(`${REMIX_API}/conf`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  return data;
};
