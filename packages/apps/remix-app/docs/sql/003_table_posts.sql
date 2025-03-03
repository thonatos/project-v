CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  tags varchar[],
  category_id UUID REFERENCES public.categories ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.users ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_posts 
  ON public.posts
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY insert_posts
  ON public.posts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY modify_own_posts
  ON public.posts
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY delete_own_posts
  ON public.posts
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);
