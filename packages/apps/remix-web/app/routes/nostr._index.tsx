import React, { useCallback } from 'react';
import { Button, ButtonGroup } from 'flowbite-react';
import { useMount } from '~/hooks/useMount';
import { useAtom } from 'jotai';
import { keysAtom, initAtom, createAtom, queryAtom } from '~/store/nostr';

import type { MetaFunction } from '@vercel/remix';

const IS_SSR = typeof window === 'undefined';

export const meta: MetaFunction = () => {
  return [
    { title: 'Nostr - ρV' },
    {
      name: 'description',
      content: 'undefined project - ρV',
    },
  ];
};

const NostrIndex: React.FC = () => {
  const [keys] = useAtom(keysAtom);
  const [_init, init] = useAtom(initAtom);
  const [_query, query] = useAtom(queryAtom);
  const [_create, create] = useAtom(createAtom);

  const getSecretKey = useCallback(() => {
    const sk = localStorage.getItem('nostr_keys') || '';
    return sk;
  }, []);

  useMount(() => {
    if (IS_SSR) {
      return;
    }

    const secretKey = getSecretKey();
    init({ sk: secretKey });
  });

  return (
    <div className="nostr-index">
      <div className="nostr-header border-b border-gray-100 pb-4">
        <h1>Nostr</h1>
      </div>
      <div className="nostr-content py-4">
        <div className="p-4">{keys?.publicKey.toBech32()}</div>
        <div className="p-4">
          <ButtonGroup>
            <Button
              color="gray"
              onClick={() => {
                create();
              }}
            >
              Create Account
            </Button>

            <Button
              color="gray"
              onClick={() => {
                query();
              }}
            >
              Query Balance
            </Button>
          </ButtonGroup>
        </div>
      </div>
    </div>
  );
};

export default NostrIndex;
