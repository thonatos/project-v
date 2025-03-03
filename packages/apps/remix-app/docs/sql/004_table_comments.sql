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
