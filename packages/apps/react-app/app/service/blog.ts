import { REMIX_WORKER_URL } from '~/constants';

export const listCategory = async () => {
  const res = await fetch(`${REMIX_WORKER_URL}/blog/categories`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  return data;
};

export const listPost = async (category: string) => {
  const res = await fetch(`${REMIX_WORKER_URL}/blog/posts?category=${category}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  return data;
};

export const getPost = async (id: string) => {
  const res = await fetch(`${REMIX_WORKER_URL}/blog/post?id=${id}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  return data;
};

export const craeteOrUpdatePost = async (value: any) => {
  const method = value.id ? 'PUT' : 'POST';

  const res = await fetch(`${REMIX_WORKER_URL}/blog/post`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(value),
    credentials: 'include',
  });

  const data = await res.json();
  return data;
};

export const deletePost = async (id: string) => {
  const res = await fetch(`${REMIX_WORKER_URL}/blog/post`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
    credentials: 'include',
  });

  const data = await res.json();
  return data;
};

export const createComment = async ({
  content,
  postId,
  parentId,
}: {
  content: string;
  postId: string;
  parentId?: string;
}): Promise<{ status: number }> => {
  const res = await fetch(`${REMIX_WORKER_URL}/blog/comment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content,
      postId,
      parentId,
    }),
    credentials: 'include',
  });

  const data = await res.json();
  return data;
};

export const deleteComment = async (id: string): Promise<{ status: number }> => {
  const res = await fetch(`${REMIX_WORKER_URL}/blog/comment`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id,
    }),
    credentials: 'include',
  });

  const data = await res.json();
  return data;
};
