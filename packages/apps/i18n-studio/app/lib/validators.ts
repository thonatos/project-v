import { z } from 'zod';

// locale: ^[a-z]{2,3}(-[a-z]{2,4})?$
export const localeSchema = z
  .string()
  .regex(/^[a-z]{2,3}(-[a-z]{2,4})?$/, '语言代码必须为小写 BCP-47 风格,例如 zh-cn / en-us / ja-jp');

// flat key: ^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*$, max 255, max 10 segments
export const flatKeySchema = z
  .string()
  .min(1, 'key 不能为空')
  .max(255, 'key 长度不能超过 255')
  .regex(/^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*$/, 'key 仅允许字母数字下划线短横线,以 . 分段')
  .refine((v) => v.split('.').length <= 10, 'key 最多 10 段');

export const slugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, 'slug 仅允许小写字母数字下划线短横线,且必须以字母数字开头');

export const roleSchema = z.enum(['admin', 'editor', 'viewer']);

export const tokenScopeSchema = z.enum(['task', 'readonly']);

export const syncStrategySchema = z.enum(['skip', 'overwrite', 'fill_missing']);

export const translationSourceSchema = z.enum(['manual', 'import', 'task', 'sync', 'revert']);

export const translationStatusSchema = z.enum(['draft', 'published', 'discarded']);

export interface KeyValidationError {
  key: string;
  reason: string;
}

export interface ParseEntriesResult {
  ok: boolean;
  errors: KeyValidationError[];
  entries: Array<{ key: string; value: string }>;
}

export function parseEntries(json: unknown): ParseEntriesResult {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return { ok: false, errors: [{ key: '', reason: '需要为 { key: value } 形式的对象' }], entries: [] };
  }
  const errors: KeyValidationError[] = [];
  const entries: Array<{ key: string; value: string }> = [];
  for (const [key, val] of Object.entries(json as Record<string, unknown>)) {
    const keyResult = flatKeySchema.safeParse(key);
    if (!keyResult.success) {
      errors.push({ key, reason: keyResult.error.issues[0]?.message ?? 'key 不合法' });
      continue;
    }
    if (typeof val !== 'string') {
      errors.push({ key, reason: 'value 必须为字符串' });
      continue;
    }
    entries.push({ key, value: val });
  }
  return { ok: errors.length === 0, errors, entries };
}

export function validateLocaleSubset(input: string[], allowed: string[]): { ok: boolean; invalid: string[] } {
  const allowSet = new Set(allowed);
  const invalid = input.filter((l) => !allowSet.has(l));
  return { ok: invalid.length === 0, invalid };
}

/**
 * 解析 `namespaces.locales` JSON 列为 string[] 的唯一入口。
 *
 * 该列以 JSON 字符串数组形式存储(无外键约束),历史上 `JSON.parse` +
 * `try/catch` + `Array.isArray` 的防御性解析散落多处。统一收敛到此函数:
 * 非法 JSON、非数组、含非 string 元素一律安全降级为已解析出的 string 子集
 * (损坏时返回空数组),调用方无需各自重复防御。
 */
export function parseNsLocales(raw: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((v): v is string => typeof v === 'string');
}
