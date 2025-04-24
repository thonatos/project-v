import { Suspense } from 'react';
import invariant from 'tiny-invariant';
import { toast } from 'sonner';
import { useAtomValue, useSetAtom } from 'jotai';
import { Link, Await, useLoaderData, useNavigate } from 'react-router';
import { PostDetail, PostSkeleton } from '~/components/biz/post-detail';
import { profileAtom } from '~/store/authAtom';
import { deletePostAtom, updatePostAtom } from '~/store/blogAtom';
import { getMeta } from '~/lib/seo-util';
import { getPost } from '~/service/blog';

import type { Route } from './+types/post.$id';

export const handle = {
  breadcrumb: () => <Link to="/">Home</Link>,
};

export const meta = ({ location, data }: Route.MetaArgs) => {
  const title = data?.post?.title;
  const description = data?.post?.excerpt;
  const pathname = location.pathname;

  const props = getMeta({
    pathname,
    title,
    description,
  });

  return [...props, { title }];
};

export const loader = async ({ params }: Route.LoaderArgs) => {
  invariant(params.id, 'id is required');

  const data = await getPost(params.id);
  return data;
};

export default function ({}: Route.ComponentProps) {
  const navigate = useNavigate();
  const loaderData = useLoaderData<typeof loader>();

  const profile = useAtomValue(profileAtom);
  const deletePost = useSetAtom(deletePostAtom);
  const updatePost = useSetAtom(updatePostAtom);

  const handleEditPost = async (id: string) => {
    if (!id || !loaderData?.post) {
      toast.error('文章不存在');
      return;
    }

    await updatePost(loaderData.post);

    navigate(`/dash/post?id=${id}`);
  };

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
      <div className="mx-auto max-w-[1400px]">
        <Suspense fallback={<PostSkeleton />}>
          <Await resolve={loaderData}>
            {(loaderData) => {
              const post = loaderData.post;
              const isOwner = !!profile && profile.id === post?.user_id;

              if (!post) {
                return <PostSkeleton />;
              }

              return (
                <PostDetail
                  post={post}
                  isOwner={isOwner}
                  onEdit={handleEditPost}
                  onDelete={handleDeletePost}
                />
              );
            }}
          </Await>
        </Suspense>
      </div>
    </div>
  );
}
