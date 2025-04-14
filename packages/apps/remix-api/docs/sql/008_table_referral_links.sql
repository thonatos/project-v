CREATE TABLE IF NOT EXISTS public.referral_links (
    id INT PRIMARY KEY,
    description TEXT,
    thumb TEXT,
    title TEXT,
    url TEXT
);

ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_referral_links
  ON public.referral_links
  FOR SELECT
  TO public
  USING (true);
