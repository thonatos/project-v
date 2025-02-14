-- 1.categories

create type category_type as enum (
  'public',
  'private'  
);

CREATE TABLE public.categories  (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- 分类唯一标识符
  name varchar NOT NULL UNIQUE, -- 分类别名
  type category_type NOT NULL DEFAULT 'public', -- 分类类型
  created_at TIMESTAMP DEFAULT NOW() -- 创建时间
);

ALTER TABLE public.categories  ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_categories
  ON public.categories
  FOR SELECT
  TO public
  USING (true);

-- 2. posts

CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- 文章唯一标识符      
  slug varchar NOT NULL, -- 文章别名  
  title TEXT NOT NULL, -- 文章标题
  excerpt TEXT NOT NULL, -- 文章摘要  
  content TEXT NOT NULL, -- 文章内容
  tags varchar[], -- 文章标签    
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE, -- 文章作者，外键关联 users
  category_id UUID REFERENCES public.categories ON DELETE SET NULL, -- 文章分类，外键关联 categories  
  created_at TIMESTAMP DEFAULT NOW(), -- 创建时间    
  updated_at TIMESTAMP DEFAULT NOW() -- 更新时间    
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


-- 3. comments

CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- 评论唯一标识符
  content TEXT NOT NULL, -- 评论内容  
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE, -- 评论者，外键关联 users
  post_id UUID NOT NULL REFERENCES public.posts ON DELETE CASCADE, -- 评论所属文章，外键关联 posts
  parent_id UUID REFERENCES public.comments ON DELETE CASCADE, -- 父评论 ID，外键关联本表
  created_at TIMESTAMP DEFAULT NOW() -- 创建时间
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
