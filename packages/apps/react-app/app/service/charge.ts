import { REMIX_API } from '~/constants';

export const createCharge = async (post_id: string) => {
  const res = await fetch(`${REMIX_API}/charge/create`, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: JSON.stringify({
      post_id,
    }),
  });

  const data = await res.json();
  return data;
};
