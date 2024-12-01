import React from 'react';
import { Link } from '@remix-run/react';
import type { MetaFunction } from '@vercel/remix';

import { LinkList } from '~/components/biz/link-list';
import { OSS_PROJECTS } from '~/constants';

export const handle = {
  breadcrumb: () => <Link to="/links">Links</Link>,
};

export const meta: MetaFunction = () => {
  return [{ title: 'Links' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

export const LinksPage: React.FC<{}> = () => {
  return (
    <div className="grid grid-cols-1">
      <h2 className="text-sm font-bold mb-6">OSS Project Links</h2>
      <LinkList projects={OSS_PROJECTS} />
    </div>
  );
};

export default LinksPage;
