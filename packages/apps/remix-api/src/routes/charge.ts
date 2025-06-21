import { Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

export const app = new Hono();

export const createCharge = async (c: Context) => {
  const post_id = c.req.query('post_id') || Date.now().toString();
  const coinbase_api_key = c.env.COINBASE_API_KEY;
  // console.log('Creating charge for post_id:', post_id);
  // console.log('Using Coinbase API Key:', coinbase_api_key);

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-CC-Api-Key': coinbase_api_key,
    },
    body: JSON.stringify({
      local_price: { amount: '1', currency: 'USDC' },
      pricing_type: 'fixed_price',
      metadata: {
        post_id,
      },
    }),
  };

  const response = await fetch('https://api.commerce.coinbase.com/charges', options);
  const data: any = await response.json();

  // console.log('Response from Coinbase:', data);

  // chack if the response contains an error
  if (!data.data?.id) {
    throw new HTTPException(400, { message: 'Failed to create charge' });
  }

  return c.json({
    data: {
      chargeId: data.data.id,
    },
  });
};

app.post('/create', createCharge);

export default app;
