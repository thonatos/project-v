import React, { useEffect } from 'react';
import { useAtom } from 'jotai';
import { appAtom } from '~/store/appAtom';

export const StrategyList: React.FC<{}> = () => {
  const [{ strategies = [] }, dispach] = useAtom(appAtom);

  useEffect(() => {
    dispach();
  }, []);

  if (!strategies.length) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-8 py-4">
      {strategies.map(({ id, title, description }) => (
        <div key={id} className="grid gap-2">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      ))}
    </div>
  );
};

export default StrategyList;
