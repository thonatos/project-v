import { Form, Link, useLoaderData, useOutletContext } from 'react-router';
import type * as React from 'react';

import { requireRole } from '~/lib/auth.server';
import {
  listQualityIssues,
  scanQualityIssues,
  updateQualityIssueStatus,
  type QualityIssueType,
  type QualitySeverity,
  type QualityStatus,
} from '~/lib/services/quality.server';
import { getNamespaceLocales } from '~/lib/services/namespace.server';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';

import type { Route } from './+types/dashboard.$slug.quality';
import type { NsContext } from './dashboard.$slug';

export async function loader({ request, params }: Route.LoaderArgs) {
  const ctx = await requireRole(request, params.slug!, ['admin', 'editor', 'viewer']);
  const url = new URL(request.url);
  const filters = {
    issueType: url.searchParams.get('issue_type') ?? '',
    locale: url.searchParams.get('locale') ?? '',
    prefix: url.searchParams.get('prefix') ?? '',
    severity: url.searchParams.get('severity') ?? '',
    status: url.searchParams.get('status') ?? 'open',
  };
  const issues = listQualityIssues({
    namespaceId: ctx.namespace.id,
    issueType: (filters.issueType as QualityIssueType) || undefined,
    locale: filters.locale || undefined,
    prefix: filters.prefix || undefined,
    severity: (filters.severity as QualitySeverity) || undefined,
    status: (filters.status as QualityStatus) || undefined,
    limit: 200,
  });
  return {
    namespace: ctx.namespace,
    role: ctx.role,
    locales: getNamespaceLocales(ctx.namespace),
    issues,
    filters,
  };
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `Quality · ${data?.namespace.name ?? 'i18n-studio'} · i18n-studio` }];
}

export async function action({ request, params }: Route.ActionArgs) {
  const ctx = await requireRole(request, params.slug!, ['admin', 'editor']);
  const form = await request.formData();
  const intent = String(form.get('intent') ?? '');
  if (intent === 'scan') {
    scanQualityIssues(ctx.namespace.id, ctx.user.id);
    return { ok: true };
  }
  if (intent === 'resolve' || intent === 'suppress') {
    const issueId = String(form.get('issueId') ?? '');
    const reason = String(form.get('reason') ?? '');
    updateQualityIssueStatus(issueId, {
      status: intent === 'resolve' ? 'resolved' : 'suppressed',
      reason: reason || undefined,
      actorId: ctx.user.id,
      namespaceId: ctx.namespace.id,
    });
    return { ok: true };
  }
  return { error: 'unknown intent' };
}

function severityVariant(severity: string): React.ComponentProps<typeof Badge>['variant'] {
  if (severity === 'error') return 'destructive';
  if (severity === 'warning') return 'default';
  return 'secondary';
}

function statusVariant(status: string): React.ComponentProps<typeof Badge>['variant'] {
  if (status === 'open') return 'default';
  if (status === 'suppressed') return 'secondary';
  return 'success';
}

export default function QualityPage() {
  useOutletContext<NsContext>();
  const { namespace, role, locales, issues, filters } = useLoaderData<typeof loader>();
  const editable = role === 'admin' || role === 'editor';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quality</h1>
          <p className="text-sm text-muted-foreground">
            {namespace.slug} · {locales.join(', ')}
          </p>
        </div>
        {editable ? (
          <Form method="post">
            <input type="hidden" name="intent" value="scan" />
            <Button type="submit">Scan</Button>
          </Form>
        ) : null}
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="get" className="grid items-end gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issue_type">Type</Label>
              <Input
                id="issue_type"
                name="issue_type"
                defaultValue={filters.issueType}
                placeholder="missing_translation"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="locale">Locale</Label>
              <Input
                id="locale"
                name="locale"
                defaultValue={filters.locale}
                placeholder="en-us"
                className="font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prefix">Prefix</Label>
              <Input
                id="prefix"
                name="prefix"
                defaultValue={filters.prefix}
                placeholder="home."
                className="font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="severity">Severity</Label>
              <Input id="severity" name="severity" defaultValue={filters.severity} placeholder="error" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Status</Label>
              <Input id="status" name="status" defaultValue={filters.status} placeholder="open" />
            </div>
            <Button type="submit">Apply</Button>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issues ({issues.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>key</TableHead>
                <TableHead>locale</TableHead>
                <TableHead>type</TableHead>
                <TableHead>severity</TableHead>
                <TableHead>status</TableHead>
                <TableHead>details</TableHead>
                {editable ? <TableHead className="w-44 text-right">actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={editable ? 7 : 6} className="py-8 text-center text-muted-foreground">
                    No quality issues
                  </TableCell>
                </TableRow>
              ) : (
                issues.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        to={`/dashboard/${namespace.slug}/entries/${encodeURIComponent(issue.key)}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {issue.key}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{issue.locale}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {issue.issueType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={severityVariant(issue.severity)}>{issue.severity}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(issue.status)}>{issue.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate font-mono text-xs text-muted-foreground">
                      {issue.details ?? '—'}
                    </TableCell>
                    {editable ? (
                      <TableCell className="text-right">
                        {issue.status === 'open' ? (
                          <div className="flex justify-end gap-1">
                            <Form method="post">
                              <input type="hidden" name="intent" value="resolve" />
                              <input type="hidden" name="issueId" value={issue.id} />
                              <Button type="submit" size="sm" variant="ghost">
                                Resolve
                              </Button>
                            </Form>
                            <Form method="post">
                              <input type="hidden" name="intent" value="suppress" />
                              <input type="hidden" name="issueId" value={issue.id} />
                              <input type="hidden" name="reason" value="accepted" />
                              <Button type="submit" size="sm" variant="ghost">
                                Suppress
                              </Button>
                            </Form>
                          </div>
                        ) : null}
                      </TableCell>
                    ) : null}
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
