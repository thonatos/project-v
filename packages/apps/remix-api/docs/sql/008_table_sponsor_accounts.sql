CREATE TABLE IF NOT EXISTS public.sponsor_accounts (
    id INT PRIMARY KEY,
    values TEXT,
    address TEXT,
    chain_id TEXT,
    network TEXT,
    symbol TEXT
);

ALTER TABLE public.sponsor_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_sponsor_accounts
  ON public.sponsor_accounts
  FOR SELECT
  TO public
  USING (true);
