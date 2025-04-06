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
  try {
    const res = await fetch(`${REMIX_WORKER_URL}/blog/category/list`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();
    return data;
  } catch (error) {
    throw error;
  }
};

export const listPost = async (category: string) => {
  try {
    const res = await fetch(`${REMIX_WORKER_URL}/blog/post/list?category=${category}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();
    return data;
  } catch (error) {
    throw error;
  }
};

export const getPost = async (id: string) => {
  try {
    const res = await fetch(`${REMIX_WORKER_URL}/blog/post/get?id=${id}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();
    return data;
  } catch (error) {
    throw error;
  }
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
  try {
    const res = await fetch(`${REMIX_WORKER_URL}/blog/post/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(value),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    throw error;
  }
};

export const deletePost = async (id: string) => {
  try {
    const res = await fetch(`${REMIX_WORKER_URL}/blog/post/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    throw error;
  }
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
  try {
    const res = await fetch(`${REMIX_WORKER_URL}/blog/comment/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        postId,
        parentId,
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    throw error;
  }
};

export const deleteComment = async (id: string): Promise<{ status: number }> => {
  try {
    const res = await fetch(`${REMIX_WORKER_URL}/blog/comment/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id,
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    throw error;
  }
};
