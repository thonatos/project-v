import { Database, GitBranch, GitMerge, Languages, ListTodo, Zap } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';

interface Feature {
  icon: typeof GitMerge;
  title: string;
  body: string;
}

const FEATURES: readonly Feature[] = [
  {
    icon: GitMerge,
    title: '草稿 / 发布 / 历史',
    body: '草稿与已发布双轨,逐条 publish/discard/revert,版本历史可追溯。',
  },
  {
    icon: GitBranch,
    title: '跨命名空间同步',
    body: '按 prefix / entry_ids 白名单从源空间拉取或推送,strategy 可选。',
  },
  {
    icon: ListTodo,
    title: '任务化协作',
    body: '把翻译工作切成 task,生成 scoped Bearer token,worker claim 后写回。',
  },
  {
    icon: Zap,
    title: 'Snapshot 通道',
    body: '只读快照路径与管理 API 解耦,ETag 304 + bundle_version,前端运行时可缓存。',
  },
  {
    icon: Languages,
    title: '系统级 locale 字典',
    body: '全站统一 locale 库,启停可控,namespace 仅引用启用集合。',
  },
  {
    icon: Database,
    title: '单文件部署',
    body: 'SQLite + better-sqlite3,WAL 模式,Docker 单容器即可运行。',
  },
];

export function Features() {
  return (
    <section id="features">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:py-20">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">为多语言团队设计的全部能力</h2>
          <p className="mt-3 text-muted-foreground">从词条管理到运行时消费,无需拼接其它服务。</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title} className="transition-all hover:-translate-y-0.5 hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <CardTitle className="text-base">{f.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">{f.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
