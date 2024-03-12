import { useState, useEffect } from 'react';

export const useMount = (fn: () => void) => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    console.log('loaded1', loaded);
    if (loaded) {
      return;
    }

    fn?.();
  }, [loaded]);

  useEffect(() => {
    console.log('loaded2', loaded);

    if (loaded) {
      return;
    }

    setLoaded(true);

    return () => {
      setLoaded(false);
    };
  }, []);
};
