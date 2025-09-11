import { useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Link, useLoaderData, useNavigate } from 'react-router';

import { PostList } from '~/components/biz/post-list';
import { PostCategory } from '~/components/biz/post-category';
import { listPost } from '~/service/blog';
import { categoriesAtom, listCategoryAtom } from '~/store/blogAtom';
import { getMeta } from '~/lib/seo-util';

import type { Route } from './+types/_index';

export const handle = {
  breadcrumb: () => <Link to="/">Home</Link>,
};

export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  const category = searchParams.get('category') ?? 'all';
  const { data } = await listPost(category);

  return { data, category };
};

export function meta({ location }: Route.MetaArgs) {
  const title = 'Home';
  const pathname = location.pathname;
  const props = getMeta({ pathname });

  return [...props, { title }];
}

const Index: React.FC<Route.ComponentProps> = ({}) => {
  const navigate = useNavigate();
  const categories = useAtomValue(categoriesAtom);
  const listCategory = useSetAtom(listCategoryAtom);
  const { data, category } = useLoaderData<typeof loader>();

  const handleCategoryChange = (category: string) => {
    navigate(`?category=${category}`);
  };

  useEffect(() => {
    if (categories.length !== 0) {
      return;
    }
    listCategory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, listCategory]);

  if (!data) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <PostCategory
        categories={['all', ...categories.map((c) => c.name)]}
        value={category}
        onChange={handleCategoryChange}
      />

      <PostList data={data} />
    </div>
  );
};

export default Index;
