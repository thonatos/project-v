import React from 'react';
import { Link } from '@remix-run/react';
import type { MetaFunction } from '@vercel/remix';

export const meta: MetaFunction = () => {
  return [
    { title: 'Links - ρV' },
    {
      name: 'description',
      content: 'undefined project - ρV',
    },
  ];
};

const links = [
  {
    name: 'Xeggex',
    url: 'https://xeggex.bull.im/',
    type: 'crypto',
  },
];

const LinkIndex: React.FC = () => {
  return (
    <div className="links-index">
      <div className="links-header border-b border-gray-100 pb-4">
        <h1>Links</h1>
      </div>
      <div className="links-content py-4">
        <div className="flex flex-col divide-y">
          {links.map((link, index) => {
            return (
              <Link to={link.url} key={index}>
                <div className="flex flex-row justify-between items-center py-3">
                  <div className="flex align-middle justify-center items-center">
                    <div className="text-sm text-green-600 w-24 uppercase">{link.type}</div>
                    <div>{link.url}</div>
                  </div>
                  <div className="text-sm text-gray-500">{link.name}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LinkIndex;
