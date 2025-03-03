CREATE type user_type as enum (
  'user',
  'admin'
);

CREATE TABLE public.users  (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL UNIQUE,
  email varchar NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role varchar NOT NULL DEFAULT 'user',
  bio TEXT,
  avatar_url varchar,
  location varchar,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_users
  ON public.users
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY insert_users
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY modify_own_users
  ON public.users
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY delete_own_users
  ON public.users
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);
