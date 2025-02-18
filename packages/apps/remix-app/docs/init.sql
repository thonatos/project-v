-- categories

create type category_type as enum (
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


-- users

CREATE TABLE public.users  (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL UNIQUE,
  email varchar NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
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

-- posts

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


-- comments

CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL, 
  parent_id UUID REFERENCES public.comments ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_comments_post_id ON public.comments(post_id);
CREATE INDEX idx_comments_parent_id ON public.comments(parent_id);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_comments 
  ON public.comments 
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY insert_comments 
  ON public.comments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
