import React from 'react';
import { Link } from '@remix-run/react';

import Logo from '~/components/biz/logo';
import Tiptap from '~/components/tiptap/editor';

import type { MetaFunction } from '@vercel/remix';

export const handle = {
  breadcrumb: () => <Link to="/support">Support</Link>,
};

export const meta: MetaFunction = () => {
  return [{ title: 'Support' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

export const SupportPage: React.FC<{}> = () => {
  return (
    <div className="grid grid-cols-1 gap-4">
      <Logo title="ρV" description="undefined project" />
      <Tiptap
        content={`
          <blockquote>
            If you need help, please contact us at
            <a href="mailto:thonatos.yang@gmail.com" className="text-blue-500">
              thonatos.yang@gmail.com
            </a>
          </blockquote>
        `}
        editable={false}
      />
    </div>
  );
};

export default SupportPage;
