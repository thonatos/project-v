import React, { useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { loadConfAtom, strategiesAtom } from '~/store/appAtom';

export const StrategyList: React.FC<{}> = () => {
  const strategies = useAtomValue(strategiesAtom);
  const loadConf = useSetAtom(loadConfAtom);

  useEffect(() => {
    if (strategies.length > 0) {
      return;
    }

    // Load configuration only if strategies are empty
    loadConf();
  }, []);

  if (!strategies.length) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4">
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
