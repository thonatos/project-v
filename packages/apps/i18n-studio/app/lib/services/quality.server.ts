import { and, eq, desc } from 'drizzle-orm';

import { getDb } from '~/lib/db.server';
import { newId, nowMs } from '~/lib/id.server';
import { entries, namespaces, qualityIssues, translations, translationVersions, type QualityIssue } from '~/db/schema';
import { getNamespaceLocales } from '~/lib/services/namespace.server';
import { writeAuditEvent } from '~/lib/services/audit.server';

export const QUALITY_RULE_VERSION = '2026-06-12.1';

export type QualityIssueType = QualityIssue['issueType'];
export type QualitySeverity = QualityIssue['severity'];
export type QualityStatus = QualityIssue['status'];

export interface QualityFinding {
  namespaceId: string;
  entryId: string;
  key: string;
  locale: string;
  sourceLocale: string | null;
  issueType: QualityIssueType;
  severity: QualitySeverity;
  sourceVersion: number | null;
  targetVersion: number | null;
  details: Record<string, unknown>;
}

export interface QualityScanResult {
  found: number;
  opened: number;
  updated: number;
  resolved: number;
}

type PublishedRow = {
  entryId: string;
  locale: string;
  value: string;
  publishedVersion: number | null;
  updatedAt: number;
};

type VersionRow = {
  id: string;
  entryId: string;
  locale: string;
  version: number;
  value: string;
  status: string;
  createdAt: number;
  publishedAt: number | null;
};

function issueKey(input: { entryId: string; locale: string; issueType: string }): string {
  return `${input.entryId}\u0000${input.locale}\u0000${input.issueType}`;
}

function extractPlaceholders(value: string): string[] {
  const matches = value.match(/{{\s*[\w.]+\s*}}|{\s*[\w.]+\s*}|%[sdif]/g) ?? [];
  return [...new Set(matches.map((m) => m.replace(/\s+/g, '')))].sort();
}

function extractHtmlTags(value: string): string[] {
  const tags: string[] = [];
  const re = /<\/?([a-zA-Z][\w:-]*)\b[^>]*>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value))) {
    tags.push(match[0]!.startsWith('</') ? `/${match[1]}` : match[1]!);
  }
  return tags.sort();
}

function diffSets(source: string[], target: string[]): { missing: string[]; extra: string[] } {
  const sourceSet = new Set(source);
  const targetSet = new Set(target);
  return {
    missing: source.filter((item) => !targetSet.has(item)),
    extra: target.filter((item) => !sourceSet.has(item)),
  };
}

function hasUnbalancedBraces(value: string): boolean {
  let depth = 0;
  for (const ch of value) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth < 0) return true;
  }
  return depth !== 0;
}

export function runQualityRules(namespaceId: string): QualityFinding[] {
  const db = getDb();
  const ns = db.select().from(namespaces).where(eq(namespaces.id, namespaceId)).get();
  if (!ns) throw new Error('namespace not found');
  const locales = getNamespaceLocales(ns);
  const sourceLocale = ns.defaultLocale;
  const entryRows = db.select().from(entries).where(eq(entries.namespaceId, namespaceId)).all();
  if (entryRows.length === 0) return [];
  const entryIds = new Set(entryRows.map((entry) => entry.id));
  const publishedRows = db
    .select({
      entryId: translations.entryId,
      locale: translations.locale,
      value: translations.value,
      publishedVersion: translations.publishedVersion,
      updatedAt: translations.updatedAt,
    })
    .from(translations)
    .all()
    .filter((row) => entryIds.has(row.entryId) && row.publishedVersion !== null) as PublishedRow[];
  const versionRows = db
    .select()
    .from(translationVersions)
    .orderBy(desc(translationVersions.version))
    .all()
    .filter((row) => entryIds.has(row.entryId)) as VersionRow[];

  const published = new Map<string, PublishedRow>();
  for (const row of publishedRows) published.set(`${row.entryId}\u0000${row.locale}`, row);
  const latestDraft = new Map<string, VersionRow>();
  const publishedVersion = new Map<string, VersionRow>();
  for (const row of versionRows) {
    const key = `${row.entryId}\u0000${row.locale}`;
    if (row.status === 'draft' && !latestDraft.has(key)) latestDraft.set(key, row);
    if (row.status === 'published' && !publishedVersion.has(`${key}\u0000${row.version}`)) {
      publishedVersion.set(`${key}\u0000${row.version}`, row);
    }
  }

  const findings: QualityFinding[] = [];
  const add = (
    entry: (typeof entryRows)[number],
    locale: string,
    issueType: QualityIssueType,
    severity: QualitySeverity,
    details: Record<string, unknown>,
    source: PublishedRow | undefined,
    target: PublishedRow | undefined,
  ) => {
    findings.push({
      namespaceId,
      entryId: entry.id,
      key: entry.key,
      locale,
      sourceLocale,
      issueType,
      severity,
      sourceVersion: source?.publishedVersion ?? null,
      targetVersion: target?.publishedVersion ?? null,
      details,
    });
  };

  for (const entry of entryRows) {
    const source = published.get(`${entry.id}\u0000${sourceLocale}`);
    const sourceVersionRow =
      source?.publishedVersion !== null && source?.publishedVersion !== undefined
        ? publishedVersion.get(`${entry.id}\u0000${sourceLocale}\u0000${source.publishedVersion}`)
        : undefined;

    for (const locale of locales) {
      const target = published.get(`${entry.id}\u0000${locale}`);
      const draft = latestDraft.get(`${entry.id}\u0000${locale}`);
      if (draft) {
        add(entry, locale, 'pending_draft', 'info', { draftVersion: draft.version }, source, target);
      }
      if (locale === sourceLocale) continue;
      if (!target) {
        add(entry, locale, 'missing_translation', 'error', {}, source, target);
        continue;
      }
      if (!source) continue;
      const targetVersionRow =
        target.publishedVersion !== null
          ? publishedVersion.get(`${entry.id}\u0000${locale}\u0000${target.publishedVersion}`)
          : undefined;
      const sourceTime = sourceVersionRow?.publishedAt ?? sourceVersionRow?.createdAt ?? source.updatedAt;
      const targetTime = targetVersionRow?.publishedAt ?? targetVersionRow?.createdAt ?? target.updatedAt;
      if (sourceTime > targetTime) {
        add(entry, locale, 'source_stale', 'warning', { sourceTime, targetTime }, source, target);
      }

      const placeholderDiff = diffSets(extractPlaceholders(source.value), extractPlaceholders(target.value));
      if (placeholderDiff.missing.length > 0 || placeholderDiff.extra.length > 0) {
        add(entry, locale, 'placeholder_mismatch', 'error', placeholderDiff, source, target);
      }

      const htmlDiff = diffSets(extractHtmlTags(source.value), extractHtmlTags(target.value));
      if (htmlDiff.missing.length > 0 || htmlDiff.extra.length > 0) {
        add(entry, locale, 'html_tag_mismatch', 'error', htmlDiff, source, target);
      }

      if (
        hasUnbalancedBraces(target.value) ||
        (source.value.includes(', plural,') && !target.value.includes(', plural,'))
      ) {
        add(entry, locale, 'icu_error', 'error', { source: source.value, target: target.value }, source, target);
      }

      if (source.value.length >= 10 && target.value.length > Math.max(80, source.value.length * 2.5)) {
        add(
          entry,
          locale,
          'length_risk',
          'warning',
          { sourceLength: source.value.length, targetLength: target.value.length },
          source,
          target,
        );
      }
    }
  }

  return findings;
}

export function scanQualityIssues(namespaceId: string, actorId: string): QualityScanResult {
  const db = getDb();
  const findings = runQualityRules(namespaceId);
  const now = nowMs();
  return db.transaction((tx) => {
    const existing = tx.select().from(qualityIssues).where(eq(qualityIssues.namespaceId, namespaceId)).all();
    const existingByKey = new Map(existing.map((issue) => [issueKey(issue), issue]));
    const findingKeys = new Set(findings.map((finding) => issueKey(finding)));
    let opened = 0;
    let updated = 0;
    let resolved = 0;

    for (const finding of findings) {
      const key = issueKey(finding);
      const existingIssue = existingByKey.get(key);
      if (existingIssue?.status === 'suppressed') continue;
      const values = {
        namespaceId,
        entryId: finding.entryId,
        key: finding.key,
        locale: finding.locale,
        sourceLocale: finding.sourceLocale,
        issueType: finding.issueType,
        severity: finding.severity,
        status: 'open' as const,
        sourceVersion: finding.sourceVersion,
        targetVersion: finding.targetVersion,
        ruleVersion: QUALITY_RULE_VERSION,
        details: JSON.stringify(finding.details),
        updatedAt: now,
      };
      if (existingIssue) {
        tx.update(qualityIssues).set(values).where(eq(qualityIssues.id, existingIssue.id)).run();
        updated++;
      } else {
        tx.insert(qualityIssues)
          .values({
            id: newId(),
            ...values,
            suppressedBy: null,
            suppressedReason: null,
            suppressedAt: null,
            resolvedAt: null,
            createdAt: now,
          })
          .run();
        opened++;
      }
    }

    for (const issue of existing) {
      if (issue.status !== 'open') continue;
      if (findingKeys.has(issueKey(issue))) continue;
      tx.update(qualityIssues)
        .set({ status: 'resolved', resolvedAt: now, updatedAt: now })
        .where(eq(qualityIssues.id, issue.id))
        .run();
      resolved++;
    }

    writeAuditEvent(tx as unknown as ReturnType<typeof getDb>, {
      namespaceId,
      actorId,
      action: 'quality.scan',
      resourceType: 'quality_issue',
      metadata: { found: findings.length, opened, updated, resolved },
    });
    return { found: findings.length, opened, updated, resolved };
  });
}

export interface ListQualityIssuesInput {
  namespaceId: string;
  issueType?: QualityIssueType;
  locale?: string;
  prefix?: string;
  severity?: QualitySeverity;
  status?: QualityStatus;
  limit?: number;
}

export function listQualityIssues(input: ListQualityIssuesInput): QualityIssue[] {
  const db = getDb();
  const rows = db
    .select()
    .from(qualityIssues)
    .where(
      and(
        eq(qualityIssues.namespaceId, input.namespaceId),
        input.issueType ? eq(qualityIssues.issueType, input.issueType) : undefined,
        input.locale ? eq(qualityIssues.locale, input.locale) : undefined,
        input.severity ? eq(qualityIssues.severity, input.severity) : undefined,
        input.status ? eq(qualityIssues.status, input.status) : undefined,
      ),
    )
    .orderBy(desc(qualityIssues.updatedAt))
    .limit(Math.min(input.limit ?? 100, 500))
    .all();
  return input.prefix ? rows.filter((issue) => issue.key.startsWith(input.prefix!)) : rows;
}

export function updateQualityIssueStatus(
  issueId: string,
  input: { status: 'resolved' | 'suppressed'; actorId: string; reason?: string; namespaceId?: string },
): QualityIssue {
  const db = getDb();
  return db.transaction((tx) => {
    const issue = tx.select().from(qualityIssues).where(eq(qualityIssues.id, issueId)).get();
    if (!issue) throw new Response('quality issue not found', { status: 404 });
    if (input.namespaceId && issue.namespaceId !== input.namespaceId) {
      throw new Response('quality issue not found', { status: 404 });
    }
    const now = nowMs();
    const patch =
      input.status === 'suppressed'
        ? {
            status: 'suppressed' as const,
            suppressedBy: input.actorId,
            suppressedReason: input.reason ?? null,
            suppressedAt: now,
            updatedAt: now,
          }
        : {
            status: 'resolved' as const,
            resolvedAt: now,
            updatedAt: now,
          };
    tx.update(qualityIssues).set(patch).where(eq(qualityIssues.id, issueId)).run();
    writeAuditEvent(tx as unknown as ReturnType<typeof getDb>, {
      namespaceId: issue.namespaceId,
      actorId: input.actorId,
      action: `quality.${input.status}`,
      resourceType: 'quality_issue',
      resourceId: issueId,
      before: issue,
      after: { ...issue, ...patch },
      metadata: input.reason ? { reason: input.reason } : undefined,
    });
    return tx.select().from(qualityIssues).where(eq(qualityIssues.id, issueId)).get()!;
  });
}
