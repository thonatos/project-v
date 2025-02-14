-- 创建递归视图，包含所有评论的嵌套层次
CREATE OR REPLACE VIEW public.comment_tree AS
WITH RECURSIVE recursive_comments AS (
    -- 获取顶级评论
    SELECT 
        id,
        content,
        user_id,
        post_id,
        parent_id,
        created_at,
        1 AS depth -- 初始层级为 1
    FROM public.comments
    WHERE parent_id IS NULL
    UNION ALL
    -- 嵌套子评论
    SELECT 
        c.id,
        c.content,
        c.user_id,
        c.post_id,
        c.parent_id,
        c.created_at,
        rc.depth + 1 -- 每次层级递增
    FROM public.comments c
    INNER JOIN recursive_comments rc ON c.parent_id = rc.id
)
SELECT * FROM recursive_comments;

-- 创建带参数的函数以实现动态过滤
CREATE OR REPLACE FUNCTION public.get_comment_tree(post_uuid UUID) 
RETURNS TABLE (
    id UUID,
    content TEXT,
    user_id UUID,
    post_id UUID,
    parent_id UUID,
    created_at TIMESTAMP,
    depth INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ct.id, 
        ct.content, 
        ct.user_id, 
        ct.post_id, 
        ct.parent_id, 
        ct.created_at, 
        ct.depth
    FROM public.comment_tree ct
    WHERE ct.post_id = post_uuid; -- 按文章 ID 过滤
END;
$$ LANGUAGE plpgsql;

SELECT * FROM public.get_comment_tree('9668a2b4-ddc1-4dbf-a2d9-0abcc4373856') 
ORDER BY depth, created_at ASC;
