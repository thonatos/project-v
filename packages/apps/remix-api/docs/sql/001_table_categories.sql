CREATE type category_type as enum (
  'public',
  'private'
);

CREATE TABLE public.categories  (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL UNIQUE,
  type category_type NOT NULL DEFAULT 'public',
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_categories
  ON public.categories
  FOR SELECT
  TO public
  USING (true);
