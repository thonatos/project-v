import { Link } from 'react-router';
import { ArrowRight, BookOpen } from 'lucide-react';

import { Button } from '~/components/ui/button';
import type { User } from '~/db/schema';

interface HeroProps {
  user: User | null;
}

export function Hero({ user }: HeroProps) {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            把多语言词条管理变成 Pull Request 一样的工作流
          </h1>
          <p className="mt-5 text-lg text-muted-foreground sm:text-xl">
            i18n-studio 把"草稿 → 发布 → 历史"建模成跨命名空间的协作流程,自带翻译任务、Snapshot 缓存通道与内置 OpenAPI
            文档。单容器部署,SQLite 一文件搞定。
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {user ? (
              <Button asChild size="lg">
                <Link to="/dashboard">
                  进入后台
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link to="/login">
                  登录
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
            <Button asChild size="lg" variant="outline">
              <Link to="/docs">
                <BookOpen className="size-4" />
                阅读文档
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
