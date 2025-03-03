CREATE OR REPLACE VIEW public.comments_with_users AS
SELECT 
    comments.id,
    comments.content,
    comments.parent_id,
    comments.post_id,
    comments.created_at,
    comments.user_id,
    users.name AS user_name,
    users.email AS user_email,
    ct.depth
FROM 
    comments
JOIN 
    public.users ON comments.user_id = users.id
JOIN 
    public.comment_tree ct ON comments.id = ct.id;
