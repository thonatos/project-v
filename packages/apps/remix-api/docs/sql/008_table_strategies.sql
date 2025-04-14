CREATE TABLE IF NOT EXISTS public.strategies (
    id INT PRIMARY KEY,
    description TEXT,
    thumb TEXT,
    title TEXT,
    url TEXT
);

ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_strategies
  ON public.strategies
  FOR SELECT
  TO public
  USING (true);
