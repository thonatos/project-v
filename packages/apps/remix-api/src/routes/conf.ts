import { Context, Hono } from 'hono';

export const app = new Hono();

export const listConf = async (c: Context) => {
  const supabase = c.get('supabase');
  const { data: strategies = [] } = await supabase.from('strategies').select();
  const { data: referral_links = [] } = await supabase.from('referral_links').select();
  const { data: sponsor_accounts = [] } = await supabase.from('sponsor_accounts').select();

  return c.json({
    data: {
      referral_links,
      strategies,
      sponsor_accounts,
    },
  });
};

app.get('/', listConf);

export default app;
