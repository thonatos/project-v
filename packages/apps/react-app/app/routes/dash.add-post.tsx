import { Suspense } from 'react';
import { Link } from 'react-router';
import { PostEditorForm } from '~/components/biz/post-editor-form';

import type { Route } from './+types/dash.add-post';

export const handle = {
  breadcrumb: () => <Link to="/dash/add-post">Add Post</Link>,
};

export const meta = ({}: Route.MetaArgs) => {
  return [{ title: 'Add Post' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

export default function ({}: Route.ComponentProps) {
  return (
    <div className="max-w-full overflow-hidden">
      <Suspense fallback={<div>loading</div>}>
        <PostEditorForm />
      </Suspense>
    </div>
  );
}
