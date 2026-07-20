import type { Route } from './+types/tags._index';
import { getAllTags } from '~/lib/docs';
import { PageShell } from '~/components/page-shell';
import { TagCloudCanvas } from '~/components/tag-cloud-canvas';

export function meta() {
  return [{ title: 'ρV - All Tags' }, { name: 'description', content: '所有标签列表' }];
}

export async function loader() {
  const tags = await getAllTags();
  return { tags };
}

export default function TagsIndex({ loaderData }: Route.ComponentProps) {
  const { tags } = loaderData;

  return (
    <PageShell width="full" overlayHeader stage mainClassName="relative">
      {/* 全宽舞台：3D 标签球（锁定单屏、禁滚动，标签球垂直居中占 60% 视高） */}
      <section className="relative flex h-full w-full flex-col items-center justify-center">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 pt-20 text-center sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl">
            <span className="text-gradient-brand">All Tags</span>
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">共 {tags.length} 个标签 · 拖拽旋转，点击进入</p>
        </div>

        {tags.length > 0 ? (
          <div className="h-[60vh] min-h-[420px] w-full">
            <TagCloudCanvas tags={tags} />
          </div>
        ) : (
          <p className="py-12 text-center text-[var(--color-text-muted)]">暂无标签</p>
        )}
      </section>
    </PageShell>
  );
}
