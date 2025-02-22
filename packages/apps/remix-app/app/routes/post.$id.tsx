import React, { Suspense } from 'react';
import invariant from 'tiny-invariant';
import { useAtomValue, useSetAtom } from 'jotai';
import { Link, Await, useLoaderData, useNavigate, ClientLoaderFunctionArgs } from '@remix-run/react';

import { createClient } from '~/modules/supabase';
import { PostDetail } from '~/components/biz/post-detail';
import { PostDetailSkeleton } from '~/components/biz/post-detail-skeleton';
import { profileAtom } from '~/store/authAtom';
import { deletePostAtom } from '~/store/blogAtom';
import { useToast } from '~/hooks/use-toast';

import type { MetaFunction, LoaderFunctionArgs } from '@vercel/remix';

export const handle = {
  breadcrumb: () => <Link to="/">Home</Link>,
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const title = data?.post?.title || 'Post';
  return [{ title: `${title} - ρV` }, { name: 'description', content: 'undefined project - ρV' }];
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  invariant(params.id, 'Missing slug param');
  const { supabase } = createClient(request);

  const { data } = await supabase.from('posts_with_users').select().eq('post_id', params.id).single();

  if (!data) {
    return {
      post: null,
      error: 'Post not found',
    };
  }

  const { post_id, ...rest } = data;

  return {
    post: {
      id: post_id,
      ...rest,
    },
  };
};

export const clientLoader = async ({ serverLoader }: ClientLoaderFunctionArgs) => {
  const serverData = await serverLoader();
  return serverData;
};

const PostDetailPage: React.FC<{}> = () => {
  const { post } = useLoaderData<typeof loader>();
  const { toast } = useToast();

  const navigate = useNavigate();
  const profile = useAtomValue(profileAtom);
  const deletePost = useSetAtom(deletePostAtom);

  const handleDeletePost = async (id: string) => {
    const { status } = await deletePost(id);

    if (status !== 204) {
      toast({
        title: '删除失败',
        description: '文章删除失败, 请稍后再试',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: '删除成功',
      description: '文章已删除, 正在跳转...',
    });

    setTimeout(() => {
      navigate(`/`);
    }, 3000);
  };

  return (
    <div className="max-w-full overflow-hidden">
      <Suspense fallback={<PostDetailSkeleton />}>
        <Await resolve={post}>
          {(postData) => {
            return postData ? (
              <PostDetail
                post={postData}
                isOwner={profile?.id === postData.user_id}
                onDelete={handleDeletePost}
              />
            ) : (
              <PostDetailSkeleton />
            );
          }}
        </Await>
      </Suspense>
    </div>
  );
};

export default PostDetailPage;
