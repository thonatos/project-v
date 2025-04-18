import { useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Link, useLoaderData, useNavigate } from 'react-router';

import { PostList } from '~/components/biz/post-list';
import { PostCategory } from '~/components/biz/post-category';
import { listPost } from '~/service/blog';
import { categoriesAtom, ListCategoryAtom } from '~/store/blogAtom';
import { getMeta } from '~/lib/seo-util';

import type { Route } from './+types/_index';

export const handle = {
  breadcrumb: () => <Link to="/">Home</Link>,
};

export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  const category = searchParams.get('category') ?? 'all';
  const data = await listPost(category);

  return data;
};

export function meta({ location }: Route.MetaArgs) {
  const title = 'Home';
  const pathname = location.pathname;
  const props = getMeta({ pathname });

  return [...props, { title }];
}

export default function ({}: Route.ComponentProps) {
  const nagivate = useNavigate();
  const categories = useAtomValue(categoriesAtom);
  const listCategory = useSetAtom(ListCategoryAtom);
  const { data, category } = useLoaderData<typeof loader>();

  const handleCategoryChange = (category: string) => {
    nagivate(`?category=${category}`);
  };

  useEffect(() => {
    if (categories.length !== 0) {
      return;
    }

    listCategory();
  }, []);

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
}
