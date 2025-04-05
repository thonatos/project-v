import { Context } from 'hono';
import { env } from 'hono/adapter';

export const listCategory = async (c: Context) => {
  const supabase = c.get('supabase');

  const { data, error } = await supabase.from('categories').select();

  return c.json({
    data,
    error,
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
    const { data } = await supabase
      .from('posts')
      .select()
      .eq('category_id', category_id)
      .order('created_at', { ascending: false })
      .limit(15);

    return c.json({
      data: data ?? [],
      category: category,
    });
  }

  const { data } = await supabase.from('posts').select().order('created_at', { ascending: false }).limit(15);

  return c.json({
    data: data ?? [],
    category: category,
  });
};

export const getPost = async (c: Context) => {
  const id = c.req.param('id');
  const supabase = c.get('supabase');

  const { data } = await supabase.from('posts_with_users').select().eq('post_id', id).single();

  if (!data) {
    return c.json({
      post: null,
      error: 'Post not found',
    });
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('posts')
    .insert({
      ...post,
      user_id: user?.id,
    })
    .select()
    .single();

  return c.json({
    data,
    error,
  });
};

export const deletePost = async (c: Context) => {
  const post = await c.req.json<{ id: string }>();
  const supabase = c.get('supabase');

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({
      error: 'Unauthorized',
    });
  }

  if (!post.id) {
    return Response.json({
      error: 'Missing post id',
    });
  }

  const { status, error } = await supabase.from('posts').delete().match({
    id: post.id,
    user_id: user.id,
  });

  return c.json({
    status,
    error,
  });
};

export const createComment = async (c: Context) => {
  const { content, postId, parentId } = await c.req.json<{
    content: string;
    postId: string;
    parentId?: string;
  }>();

  const supabase = c.get('supabase');

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({
      status: 401,
      error: 'Unauthorized',
    });
  }

  if (!content || !postId) {
    return Response.json({
      status: 400,
      error: 'Missing required fields',
    });
  }

  const { status, error } = await supabase.from('comments').insert({
    content,
    post_id: postId,
    parent_id: parentId || null,
    user_id: user.id,
  });

  return c.json({
    status,
    error,
  });
};

export const deleteComment = async (c: Context) => {
  const { id } = await c.req.json<{
    id: string;
  }>();

  const supabase = c.get('supabase');

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({
      status: 401,
      error: 'Unauthorized',
    });
  }

  if (!id) {
    return Response.json({
      status: 400,
      error: 'Missing comment id',
    });
  }

  const { status, error } = await supabase.from('comments').delete().match({
    id,
    user_id: user.id,
  });

  return c.json({
    status,
    error,
  });
};
