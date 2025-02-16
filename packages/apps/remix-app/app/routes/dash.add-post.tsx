import React, { Suspense } from 'react';
import { Link } from '@remix-run/react';
import { PostEditorForm } from '~/components/biz/post-editor-form';

import type { MetaFunction } from '@vercel/remix';

export const handle = {
  breadcrumb: () => <Link to="/dash/add-post">Add Post</Link>,
};

export const meta: MetaFunction = () => {
  return [{ title: 'Tiptap' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

export const PostNewPage: React.FC<{}> = () => {
  return (
    <div className="max-w-full overflow-hidden">
      <Suspense fallback={<div>loading</div>}>
        <PostEditorForm />
      </Suspense>
    </div>
  );
};

export default PostNewPage;
