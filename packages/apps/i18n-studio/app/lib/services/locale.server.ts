import { eq, asc } from 'drizzle-orm';

import { getDb } from '~/lib/db.server';
import { nowMs } from '~/lib/id.server';
import { locales, namespaces } from '~/db/schema';
import type { Locale } from '~/db/schema';
import { localeSchema, parseNsLocales } from '~/lib/validators';
import { jsonError } from '~/lib/api.server';

export type { Locale };

export interface CreateLocaleInput {
  code: string;
  label: string;
  englishLabel: string;
  nativeLabel?: string | null;
  region?: string | null;
}

export interface UpdateLocaleInput {
  label?: string;
  englishLabel?: string;
  nativeLabel?: string | null;
  region?: string | null;
}

const LABEL_MAX = 64;
const REGION_MAX = 8;

function validateLabel(value: string, field: string): void {
  if (typeof value !== 'string' || value.length === 0 || value.length > LABEL_MAX) {
    throw jsonError(422, 'locale_invalid_label', `${field} 长度必须在 1-${LABEL_MAX} 之间`);
  }
}

export function listLocales(opts?: { enabledOnly?: boolean }): Locale[] {
  const db = getDb();
  const rows = db.select().from(locales).orderBy(asc(locales.sortOrder), asc(locales.code)).all();
  return opts?.enabledOnly ? rows.filter((r) => r.enabled) : rows;
}

export function listEnabledLocales(): Locale[] {
  return listLocales({ enabledOnly: true });
}

export function getLocale(code: string): Locale | null {
  const db = getDb();
  return db.select().from(locales).where(eq(locales.code, code)).get() ?? null;
}

export function createLocale(input: CreateLocaleInput): Locale {
  const codeResult = localeSchema.safeParse(input.code);
  if (!codeResult.success) {
    throw jsonError(422, 'locale_invalid_code', codeResult.error.issues[0]?.message ?? 'code 不合法');
  }
  validateLabel(input.label, 'label');
  validateLabel(input.englishLabel, 'englishLabel');
  if (input.nativeLabel != null) validateLabel(input.nativeLabel, 'nativeLabel');
  if (input.region != null && input.region.length > REGION_MAX) {
    throw jsonError(422, 'locale_invalid_region', `region 长度不能超过 ${REGION_MAX}`);
  }

  const db = getDb();
  const existing = db.select().from(locales).where(eq(locales.code, input.code)).get();
  if (existing) {
    throw jsonError(409, 'locale_already_exists', `locale ${input.code} 已存在`);
  }

  const maxRow = db.select({ s: locales.sortOrder }).from(locales).orderBy(asc(locales.sortOrder)).all();
  const nextSort = (maxRow.at(-1)?.s ?? 0) + 10;
  const now = nowMs();
  const row: Locale = {
    code: input.code,
    label: input.label,
    englishLabel: input.englishLabel,
    nativeLabel: input.nativeLabel ?? null,
    region: input.region ?? null,
    isBuiltin: false,
    enabled: true,
    sortOrder: nextSort,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(locales).values(row).run();
  return row;
}

export function updateLocale(code: string, patch: UpdateLocaleInput): Locale {
  const db = getDb();
  const existing = db.select().from(locales).where(eq(locales.code, code)).get();
  if (!existing) {
    throw jsonError(404, 'locale_not_found', `locale ${code} 不存在`);
  }
  if (patch.label !== undefined) validateLabel(patch.label, 'label');
  if (patch.englishLabel !== undefined) validateLabel(patch.englishLabel, 'englishLabel');
  if (patch.nativeLabel != null) validateLabel(patch.nativeLabel, 'nativeLabel');
  if (patch.region != null && patch.region.length > REGION_MAX) {
    throw jsonError(422, 'locale_invalid_region', `region 长度不能超过 ${REGION_MAX}`);
  }
  const next = {
    ...existing,
    ...patch,
    nativeLabel: patch.nativeLabel === undefined ? existing.nativeLabel : (patch.nativeLabel ?? null),
    region: patch.region === undefined ? existing.region : (patch.region ?? null),
    updatedAt: nowMs(),
  };
  db.update(locales).set(next).where(eq(locales.code, code)).run();
  return next;
}

export function setEnabled(code: string, enabled: boolean): Locale {
  const db = getDb();
  const existing = db.select().from(locales).where(eq(locales.code, code)).get();
  if (!existing) {
    throw jsonError(404, 'locale_not_found', `locale ${code} 不存在`);
  }
  if (!enabled) {
    const refs = listReferencingNamespaces(code);
    if (refs.length > 0) {
      throw jsonError(409, 'locale_in_use', `locale ${code} 仍被 ${refs.length} 个 namespace 引用,无法禁用`, {
        namespaces: refs.slice(0, 5),
      });
    }
  }
  const next = { ...existing, enabled, updatedAt: nowMs() };
  db.update(locales).set(next).where(eq(locales.code, code)).run();
  return next;
}

export function deleteLocale(code: string): void {
  const db = getDb();
  const existing = db.select().from(locales).where(eq(locales.code, code)).get();
  if (!existing) {
    throw jsonError(404, 'locale_not_found', `locale ${code} 不存在`);
  }
  if (existing.isBuiltin) {
    throw jsonError(409, 'locale_builtin_undeletable', `内置 locale ${code} 不可删除,可改为禁用`);
  }
  const refs = listReferencingNamespaces(code);
  if (refs.length > 0) {
    throw jsonError(409, 'locale_in_use', `locale ${code} 仍被 ${refs.length} 个 namespace 引用,无法删除`, {
      namespaces: refs.slice(0, 5),
    });
  }
  db.delete(locales).where(eq(locales.code, code)).run();
}

/**
 * 校验给定 code 集合全部存在于字典且 enabled=1。
 * 失败抛 422 Response,errors 列出问题项。
 */
export function assertLocalesExist(codes: string[]): void {
  if (codes.length === 0) return;
  const all = listLocales();
  const byCode = new Map(all.map((l) => [l.code, l]));
  const notFound: string[] = [];
  const disabled: string[] = [];
  for (const c of codes) {
    const row = byCode.get(c);
    if (!row) notFound.push(c);
    else if (!row.enabled) disabled.push(c);
  }
  if (notFound.length > 0) {
    throw jsonError(422, 'locale_not_found', `以下 locale 未在字典中: ${notFound.join(', ')}`, {
      codes: notFound,
    });
  }
  if (disabled.length > 0) {
    throw jsonError(422, 'locale_disabled', `以下 locale 已禁用: ${disabled.join(', ')}`, {
      codes: disabled,
    });
  }
}

/**
 * 扫描 namespaces.locales JSON,返回引用该 code 的 namespace 摘要列表。
 */
export function listReferencingNamespaces(code: string): Array<{ id: string; slug: string }> {
  const db = getDb();
  const rows = db
    .select({ id: namespaces.id, slug: namespaces.slug, locales: namespaces.locales })
    .from(namespaces)
    .all();
  const referrers: Array<{ id: string; slug: string }> = [];
  for (const r of rows) {
    if (parseNsLocales(r.locales).includes(code)) {
      referrers.push({ id: r.id, slug: r.slug });
    }
  }
  return referrers;
}
