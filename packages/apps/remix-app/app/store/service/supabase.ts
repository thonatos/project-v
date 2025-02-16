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
