import { REMIX_WORKER_URL } from '~/constants';

/**
 * Categories Service
 *
 * Table Schema:
 * - id: UUID PRIMARY KEY
 * - name: varchar NOT NULL UNIQUE
 * - type: category_type NOT NULL DEFAULT 'public'
 * - created_at: TIMESTAMP DEFAULT NOW()
 */
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

/**
 * Posts Service
 *
 * Table Schema:
 * - id: UUID PRIMARY KEY
 * - title: TEXT NOT NULL
 * - excerpt: TEXT NOT NULL
 * - content: TEXT NOT NULL
 * - tags: varchar[]
 * - category_id: UUID (references categories)
 * - user_id: UUID NOT NULL (references users)
 * - created_at: TIMESTAMP DEFAULT NOW()
 * - updated_at: TIMESTAMP DEFAULT NOW()
 */
export const craeteOrUpdatePost = async (value: any) => {
  const res = await fetch(`${REMIX_WORKER_URL}/blog/post`, {
    method: 'POST',
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

/**
 * Comments Service
 *
 * Table Schema:
 * - id: UUID PRIMARY KEY
 * - content: TEXT NOT NULL
 * - parent_id: UUID (references comments)
 * - post_id: UUID NOT NULL (references posts)
 * - user_id: UUID NOT NULL (references users)
 * - created_at: TIMESTAMP DEFAULT NOW()
 */
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
