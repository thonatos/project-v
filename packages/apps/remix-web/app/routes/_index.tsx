import { json } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';

import { TagCloud } from 'react-tagcloud';
import { api, Post, Tag } from '~/model/ghost';
import { Layout } from '~/components/Layout';

import type { MetaFunction } from '@vercel/remix';
import type { LoaderFunctionArgs } from '@remix-run/node';

export const meta: MetaFunction = () => {
  return [
    { title: 'Home - ρV' },
    {
      name: 'description',
      content: 'undefined project - ρV',
    },
  ];
};

export const loader = async (params: LoaderFunctionArgs) => {
  const posts = await api.posts
    .browse({
      limit: 15,
      filter: 'featured:true+visibility:public',
    })
    .fields({
      id: true,
      slug: true,
      title: true,
      feature_image: true,
    })
    .fetch();

  const tags = await api.tags
    .browse({
      limit: 15,
      filter: 'visibility:public',
    })
    .include({
      'count.posts': true,
    })
    .fetch();

  return json({
    posts: posts.success ? (posts.data as Post[]) : [],
    tags: tags.success ? (tags.data as Tag[]) : [],
  });
};

export default function Index() {
  const { posts, tags } = useLoaderData<typeof loader>();

  const data =
    tags.map((tag) => {
      return {
        value: tag.name,
        count: tag.count?.posts || 0,
      };
    }) || [];

  return (
    <Layout>
      <div className="home-index divide-y-[1px]">
        <div>
          <TagCloud
            minSize={32}
            maxSize={64}
            tags={data}
            className="min-h-[100px] mb-4 text-center"
            shuffle={true}
            renderer={(tag, size, color) => {
              return (
                <Link to={`/docs?tag=${tag.value}`} key={tag.key}>
                  <span
                    key={tag.key}
                    style={{
                      color: color,
                      fontSize: size,
                      animation: 'blinker 3s linear infinite',
                      animationDelay: `${Math.random() * 2}s`,
                      margin: '3px',
                      padding: '6px',
                      display: 'inline-block',
                    }}
                  >
                    {tag.value}
                  </span>
                </Link>
              );
            }}
          />
        </div>

        <div>
          <div className="my-4">FEATURED ARTICLES</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
            {posts.map((post) => {
              return (
                <Link to={`/docs/${post.slug}`} key={post.id}>
                  <div className="bg-gray-50 text-center text-slate-400 rounded">
                    <img src={post.feature_image} alt="" className="object-cover h-48 w-96" />
                    <div className="p-2">{post.title}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
