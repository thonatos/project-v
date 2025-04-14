CREATE TABLE IF NOT EXISTS public.credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users ON DELETE CASCADE,
    credential_id TEXT NOT NULL,
    credential_key JSON NOT NULL,        
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()    
);

ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;

-- 策略：仅允许认证用户读取自己的凭证
CREATE POLICY select_credentials
  ON public.credentials
  FOR SELECT
  TO public
  USING (true);

-- 策略：仅允许认证用户插入凭证
CREATE POLICY insert_credentials
  ON public.credentials
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 策略：仅允许认证用户修改自己的凭证
CREATE POLICY modify_own_credentials
  ON public.credentials
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 策略：仅允许认证用户删除自己的凭证
CREATE POLICY delete_own_credentials
  ON public.credentials
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
