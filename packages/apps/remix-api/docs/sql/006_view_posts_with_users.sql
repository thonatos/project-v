CREATE OR REPLACE VIEW public.posts_with_users AS
SELECT 
    posts.id as post_id,
    posts.excerpt,
    posts.tags,
    posts.title,
    posts.content,
    posts.created_at,
    posts.updated_at,
    users.id AS user_id,
    users.name AS user_name,
    users.email AS user_email,
    categories.id AS category_id,
    categories.name AS category_name
FROM 
    posts
JOIN 
    public.users ON posts.user_id = users.id
JOIN 
    public.categories ON posts.category_id = categories.id;

-- DROP VIEW public.posts_with_users;
-- DELETE FROM auth.users where id = '9e8be9db-4730-49bf-871b-33186f0fab27';
-- SELECT * FROM public.posts_with_users WHERE post_id = '1b1415d6-1c0d-415a-9057-7212002265f8';
