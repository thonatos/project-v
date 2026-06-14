import { useLoaderData, useOutletContext } from 'react-router';
import type * as React from 'react';

import { requireRole } from '~/lib/auth.server';
import { getTaskDetail } from '~/lib/services/task.server';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';

import type { Route } from './+types/dashboard.$slug.tasks.$id';
import type { NsContext } from './dashboard.$slug';

export async function loader({ request, params }: Route.LoaderArgs) {
  const ctx = await requireRole(request, params.slug!, ['admin', 'editor', 'viewer']);
  const detail = getTaskDetail(params.id!);
  if (!detail || detail.task.namespaceId !== ctx.namespace.id) {
    throw new Response('task not found', { status: 404 });
  }
  return {
    namespace: ctx.namespace,
    detail,
  };
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `Task ${data?.detail.task.id.slice(0, 10) ?? ''} · ${data?.namespace.name ?? 'i18n-studio'}` }];
}

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

function statusVariant(status: string): React.ComponentProps<typeof Badge>['variant'] {
  switch (status as TaskStatus) {
    case 'pending':
      return 'secondary';
    case 'in_progress':
      return 'default';
    case 'completed':
      return 'success';
    case 'failed':
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}

function formatTime(value: number | null): string {
  return value ? new Date(value).toLocaleString() : '—';
}

export default function TaskDetailPage() {
  useOutletContext<NsContext>();
  const { namespace, detail } = useLoaderData<typeof loader>();
  const { task, items, logs, summary } = detail;
  const targetLocales = JSON.parse(task.targetLocales) as string[];
  const statusEntries = Object.entries(summary.statusCounts).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">任务详情</h1>
          <Badge variant={statusVariant(task.status)}>{task.status}</Badge>
        </div>
        <p className="font-mono text-sm text-muted-foreground">
          {namespace.slug}/{task.id}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Progress</CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-2xl">
            {task.done}/{task.total}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Workers</CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-sm">{summary.workerIds.join(', ') || '—'}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active leases</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <span className="font-mono text-2xl">{summary.activeLeaseCount}</span>
            <div className="mt-1 text-xs text-muted-foreground">{formatTime(summary.nextLeaseExpiresAt)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Errors</CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-2xl">{summary.errorCount}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">状态分布</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {statusEntries.length === 0 ? (
            <span className="text-sm text-muted-foreground">No items</span>
          ) : (
            statusEntries.map(([status, count]) => (
              <Badge key={status} variant={statusVariant(status)} className="font-mono">
                {status}:{count}
              </Badge>
            ))
          )}
          {targetLocales.map((locale) => (
            <Badge key={locale} variant="outline" className="font-mono">
              {locale}
            </Badge>
          ))}
        </CardContent>
      </Card>

      {summary.errors.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">错误摘要</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>key</TableHead>
                  <TableHead>locale</TableHead>
                  <TableHead>status</TableHead>
                  <TableHead>last error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.errors.map((error) => (
                  <TableRow key={error.itemId}>
                    <TableCell className="font-mono text-xs">{error.key}</TableCell>
                    <TableCell className="font-mono text-xs">{error.targetLocale ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(error.status)}>{error.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{error.lastError}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>key</TableHead>
                <TableHead>locale</TableHead>
                <TableHead>status</TableHead>
                <TableHead>worker</TableHead>
                <TableHead>lease</TableHead>
                <TableHead>attempts</TableHead>
                <TableHead>completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.key}</TableCell>
                  <TableCell className="font-mono text-xs">{item.targetLocale ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.leasedBy ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatTime(item.leaseExpiresAt)}</TableCell>
                  <TableCell className="font-mono text-xs">{item.attemptCount}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatTime(item.completedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logs ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>time</TableHead>
                <TableHead>event</TableHead>
                <TableHead>worker</TableHead>
                <TableHead>item</TableHead>
                <TableHead>message</TableHead>
                <TableHead>metadata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No task logs
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground">{formatTime(log.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {log.event}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.workerId ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{log.itemId ? log.itemId.slice(0, 10) : '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.message ?? '—'}</TableCell>
                    <TableCell className="max-w-md truncate font-mono text-xs text-muted-foreground">
                      {log.metadata ?? '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
