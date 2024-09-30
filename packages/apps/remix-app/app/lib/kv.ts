import { kv } from '@vercel/kv';

export const getValue = async (key: string) => {
  const value = await kv.get(key);  

  if (!value) {
    return null;
  }

  return value;
};

export const setValue = async (key: string, value: any) => {  
  return kv.set(key, value, {
    ex: 86400,  // 60*60*24=86400,
    nx: true,
  });
};
