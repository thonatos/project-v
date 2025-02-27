import React from 'react';
import { Link } from '@remix-run/react';
import type { MetaFunction } from '@vercel/remix';

import { Logo } from '~/components/custom/logo';
import { Tiptap } from '~/components/tiptap/editor';
import { ProjectList } from '~/components/biz/project-list';
import { OSS_PROJECTS } from '~/constants';

export const handle = {
  breadcrumb: () => <Link to="/support">Support</Link>,
};

export const meta: MetaFunction = () => {
  return [{ title: 'Support' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

export const SupportPage: React.FC<{}> = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <div className="md:col-span-4 space-y-4">
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

      <ProjectList projects={OSS_PROJECTS} />
    </div>
  );
};

export default SupportPage;
