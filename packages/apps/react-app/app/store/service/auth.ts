import { REMIX_WORKER_URL } from '~/constants';

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
    const res = await fetch(`${REMIX_WORKER_URL}/auth/profile`, {
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

export const loginWithPassword = async (email: string, password: string) => {
  try {
    const res = await fetch(`${REMIX_WORKER_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    throw error;
  }
};
