import React from 'react';
import { Button, ButtonGroup } from 'flowbite-react';
import { useMount } from '~/hooks/useMount';

import type { MetaFunction } from '@vercel/remix';
import { FullCard } from '~/components/FullCard';
import { ColumnData, ColumnProp, FullTable } from '~/components/FullTable';

const IS_SSR = typeof window === 'undefined';

export const meta: MetaFunction = () => {
  return [
    { title: 'Demo - ρV' },
    {
      name: 'description',
      content: 'undefined project - ρV',
    },
  ];
};

const DemoIndex: React.FC = () => {
  useMount(() => {
    if (IS_SSR) {
      return;
    }
  });

  const columns: ColumnProp[] = [
    {
      key: 'name',
      name: 'Product name',
    },
    {
      key: 'color',
      name: 'Color',
    },
    {
      key: 'category',
      name: 'Category',
    },
    {
      key: 'price',
      name: 'Price',
    },
  ];

  const data: ColumnData[] = [
    {
      value: {
        name: 'Apple MacBook Pro 17',
        color: 'Sliver',
        category: 'Laptop',
        price: '$2999',
      },
    },
    {
      value: {
        name: 'Microsoft Surface Pro',
        color: 'White',
        category: 'Laptop PC',
        price: '$1999',
      },
    },
    {
      value: {
        name: 'Magic Mouse 2',
        color: 'Black',
        category: 'Accessories',
        price: '$99',
      },
    },
  ];

  return (
    <div className="demo-index">
      <div className="demo-header border-b border-gray-100 pb-4">
        <h1>Demo</h1>
      </div>
      <div className="demo-content py-4">
        <div className="flex flex-col divide-y gap-4">
          <div className="mx-auto w-full">
            <ButtonGroup>
              <Button color="gray">Create Account</Button>
              <Button color="gray">Query Balance</Button>
            </ButtonGroup>
          </div>

          <div className="mx-auto w-full pt-4">
            <FullCard>
              <div className="p-4">header</div>
              <div className="p-4 py-6 rounded-lg bg-gray-400">content</div>
            </FullCard>
          </div>

          <div className="mx-auto w-full pt-4">
            <FullTable columns={columns} data={data} currentPage={1} onPageChange={() => {}} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoIndex;
