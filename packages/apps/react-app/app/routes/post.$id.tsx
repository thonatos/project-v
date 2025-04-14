import { Suspense } from 'react';
import invariant from 'tiny-invariant';
import { toast } from 'sonner';
import { useAtomValue, useSetAtom } from 'jotai';
import { Link, Await, useLoaderData, useNavigate } from 'react-router';
import { PostDetail } from '~/components/biz/post-detail';
import { PostDetailSkeleton } from '~/components/biz/post-detail-skeleton';
import { profileAtom } from '~/store/authAtom';
import { deletePostAtom } from '~/store/blogAtom';
import { getPost } from '~/service/blog';

import type { Route } from './+types/post.$id';

export const handle = {
  breadcrumb: () => <Link to="/">Home</Link>,
};

export const meta = ({ data }: Route.MetaArgs) => {
  const title = data?.post?.title || 'Post';
  return [{ title: `${title} - ρV` }, { name: 'description', content: 'undefined project - ρV' }];
};

export const loader = async ({ params, request }: Route.LoaderArgs) => {
  invariant(params.id, 'id is required');

  const data = await getPost(params.id);
  return data;
};

export default function ({}: Route.ComponentProps) {
  const loaderData = useLoaderData<typeof loader>();
  // console.log('loaderData', loaderData);

  const navigate = useNavigate();
  const profile = useAtomValue(profileAtom);
  const deletePost = useSetAtom(deletePostAtom);

  const handleDeletePost = async (id: string) => {
    const { data } = await deletePost(id);

    if (data !== 204) {
      toast.warning('文章删除失败, 请稍后再试');
      return;
    }

    toast('文章已删除, 正在跳转...');

    setTimeout(() => {
      navigate(`/`);
    }, 3000);
  };

  return (
    <div className="max-w-full overflow-hidden">
      <Suspense fallback={<PostDetailSkeleton />}>
        <Await resolve={loaderData}>
          {(loaderData) => {
            const isOwner = !!profile && profile.id === loaderData?.post?.user_id;
            return loaderData ? (
              <PostDetail post={loaderData.post} isOwner={isOwner} onDelete={handleDeletePost} />
            ) : (
              <PostDetailSkeleton />
            );
          }}
        </Await>
      </Suspense>
    </div>
  );
}
