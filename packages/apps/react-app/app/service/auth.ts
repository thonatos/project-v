import { REMIX_WORKER_URL } from '~/constants';

export const getProfile = async () => {
  const res = await fetch(`${REMIX_WORKER_URL}/auth/profile`, {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  const data = await res.json();
  return data;
};

export const loginWithPassword = async (email: string, password: string) => {
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
};

export const getChallenge = async () => {
  const res = await fetch(`${REMIX_WORKER_URL}/passkey/challenge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: null,
    credentials: 'include',
  });

  const data = await res.json();
  return data;
};

export const registerPasskey = async ({
  registration,
  challenge,
}: {
  registration: any;
  challenge: string;
}) => {
  const res = await fetch(`${REMIX_WORKER_URL}/passkey/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      registration,
      challenge,
    }),
    credentials: 'include',
  });

  const data = await res.json();
  return data;
};

export const authenticatePasskey = async ({
  authentication,
  challenge,
}: {
  authentication: any;
  challenge: string;
}) => {
  const res = await fetch(`${REMIX_WORKER_URL}/passkey/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      authentication,
      challenge,
    }),
    credentials: 'include',
  });

  const data = await res.json();
  return data;
};
