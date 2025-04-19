import { Suspense } from 'react';
import loadable from '@loadable/component';
import { Link, useSearchParams } from 'react-router';
// import { PostEditorForm } from '~/components/biz/post-editor-form';

import type { Route } from './+types/dash.post';

const PostEditorForm = loadable<{ id?: string }>(() => import('~/components/biz/post-editor-form'));

export const handle = {
  breadcrumb: () => <Link to="/dash/post">Post</Link>,
};

export const meta = ({}: Route.MetaArgs) => {
  return [{ title: 'Post' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

export default function ({}: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id') || '';

  return (
    <div className="max-w-full overflow-hidden">
      <Suspense fallback={<div>loading</div>}>
        <PostEditorForm id={id} />
      </Suspense>
    </div>
  );
}
