import React from 'react';
import { useAtomValue } from 'jotai';
import { Link, useLoaderData, useNavigate } from '@remix-run/react';

import { PostCategory } from '~/components/biz/post-category';
import { categoriesAtom } from '~/store/blogAtom';
import { createClient } from '~/supabase-module';

import type { MetaFunction, LoaderFunctionArgs } from '@vercel/remix';
import { PostList } from '~/components/biz/post-list';

export const handle = {
  breadcrumb: () => <Link to="/">Home</Link>,
};

export const meta: MetaFunction = () => {
  return [{ title: 'Home' }, { name: 'ρV', content: 'undefined project - ρV' }];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);
  const category = searchParams.get('category') ?? 'all';

  let category_id;

  const { supabase } = createClient(request);

  if (category !== 'all') {
    const { data: categoryData } = await supabase.from('categories').select().eq('name', category);
    category_id = categoryData && categoryData[0].id;
  }

  if (category_id) {
    const { data } = await supabase
      .from('posts')
      .select()
      .eq('category_id', category_id)
      .order('created_at', { ascending: false })
      .limit(15);

    return {
      data: data ?? [],
      category: category,
    };
  }

  const { data } = await supabase.from('posts').select().order('created_at', { ascending: false }).limit(15);

  return {
    data: data ?? [],
    category: category,
  };
};

const IndexPage: React.FC<{}> = () => {
  const nagivate = useNavigate();
  const categories = useAtomValue(categoriesAtom);
  const { data, category } = useLoaderData<typeof loader>();

  const handleCategoryChange = (category: string) => {
    nagivate(`?category=${category}`);
  };

  return (
    <div className="space-y-4">
      <PostCategory
        categories={['all', ...categories.map((c) => c.name)]}
        value={category}
        onChange={(category) => {
          handleCategoryChange(category);
        }}
      />

      <PostList data={data} />
    </div>
  );
};

export default IndexPage;
