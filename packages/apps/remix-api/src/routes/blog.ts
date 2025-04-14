import { Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getUserId, setUserId } from '../util';

export const app = new Hono();

export const listCategory = async (c: Context) => {
  const supabase = c.get('supabase');

  const { data, error } = await supabase.from('categories').select();

  if (error) {
    throw new HTTPException(400, { message: error.message });
  }

  return c.json({
    data,
  });
};

export const listPost = async (c: Context) => {
  const category = c.req.query('category') || 'all';
  const supabase = c.get('supabase');

  let category_id;

  if (category !== 'all') {
    const { data: categoryData } = await supabase.from('categories').select().eq('name', category);
    category_id = categoryData && categoryData[0].id;
  }

  if (category_id) {
    const { data = [] } = await supabase
      .from('posts')
      .select()
      .eq('category_id', category_id)
      .order('created_at', { ascending: false })
      .limit(15);

    return c.json({
      data,
      category: category,
    });
  }

  const { data = [] } = await supabase
    .from('posts')
    .select()
    .order('created_at', { ascending: false })
    .limit(15);

  return c.json({
    data,
    category: category,
  });
};

export const getPost = async (c: Context) => {
  const id = c.req.query('id');
  const supabase = c.get('supabase');

  const { data } = await supabase.from('posts_with_users').select().eq('post_id', id).single();

  if (!data) {
    throw new HTTPException(400, { message: 'Post not found' });
  }

  const { post_id, ...rest } = data;

  return c.json({
    post: {
      id: post_id,
      ...rest,
    },
  });
};

export const createPost = async (c: Context) => {
  const post = await c.req.json<{}>();
  const supabase = c.get('supabase');
  const user_id = await getUserId(c);

  if (!user_id) {
    throw new HTTPException(403, { message: 'Unauthorized' });
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({
      ...post,
      user_id,
    })
    .select()
    .single();

  if (error) {
    throw new HTTPException(400, { message: error.message });
  }

  return c.json({
    data,
  });
};

export const deletePost = async (c: Context) => {
  const post = await c.req.json<{ id: string }>();
  const supabase = c.get('supabase');
  const user_id = await getUserId(c);

  if (!user_id) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }

  if (!post.id) {
    throw new HTTPException(400, { message: 'Missing post id' });
  }

  const { status, error } = await supabase.from('posts').delete().match({
    id: post.id,
    user_id,
  });

  if (error) {
    throw new HTTPException(400, { message: error.message });
  }

  return c.json({
    data: status,
  });
};

export const createComment = async (c: Context) => {
  const { content, postId, parentId } = await c.req.json<{
    content: string;
    postId: string;
    parentId?: string;
  }>();

  const supabase = c.get('supabase');
  const user_id = await getUserId(c);

  if (!user_id) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }

  if (!content || !postId) {
    throw new HTTPException(400, { message: 'Missing required fields' });
  }

  const { status, error } = await supabase.from('comments').insert({
    content,
    post_id: postId,
    parent_id: parentId || null,
    user_id,
  });

  if (error) {
    throw new HTTPException(400, { message: error.message });
  }

  return c.json({
    data: status,
  });
};

export const deleteComment = async (c: Context) => {
  const { id } = await c.req.json<{
    id: string;
  }>();

  const supabase = c.get('supabase');
  const user_id = await getUserId(c);

  if (!user_id) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }

  if (!id) {
    throw new HTTPException(400, { message: 'Missing comment id' });
  }

  const { status, error } = await supabase.from('comments').delete().match({
    id,
    user_id,
  });

  if (error) {
    throw new HTTPException(400, { message: error.message });
  }

  return c.json({
    data: status,
  });
};

app.get('/posts', listPost);
app.get('/categories', listCategory);

app.get('/post', getPost);
app.post('/post', createPost);
app.delete('/post', deletePost);

app.post('/comment', createComment);
app.delete('/comment', deleteComment);

export default app;
