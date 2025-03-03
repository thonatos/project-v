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
    const res = await fetch('/action/list-category', {
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
    const res = await fetch('/action/create-post', {
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
    const res = await fetch('/action/delete-post', {
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
 * Users Service
 *
 * Table Schema:
 * - id: UUID PRIMARY KEY
 * - name: varchar NOT NULL UNIQUE
 * - email: varchar NOT NULL
 * - user_id: UUID NOT NULL (references auth.users)
 * - created_at: TIMESTAMP DEFAULT NOW()
 */
export const getProfile = async () => {
  try {
    const res = await fetch('/action/get-profile', {
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
    const res = await fetch('/action/comment-post', {
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
    const res = await fetch('/action/delete-comment', {
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
