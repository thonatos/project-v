/**
 * Repair script: scan all `namespaces.locales` JSON arrays for codes that are
 * not present in the system `locales` dictionary, and either report them
 * (default) or auto-add them as non-builtin enabled entries (--auto-add).
 *
 * Run via: `pnpm -F i18n-studio repair:locales [--auto-add]`
 *
 * Exit codes:
 *   0 — nothing to repair, or --auto-add succeeded
 *   1 — found dangling codes in default mode (manual decision required)
 */
import { getDb } from '~/lib/db.server';
import { nowMs } from '~/lib/id.server';
import { locales, namespaces } from '~/db/schema';

export interface RepairReport {
  ok: boolean;
  /** code → namespaces referring to it */
  missing: Record<string, string[]>;
  added: string[];
}

export interface RepairOptions {
  autoAdd?: boolean;
}

export function repairLocales(opts: RepairOptions = {}): RepairReport {
  const db = getDb();
  const dictRows = db.select({ code: locales.code }).from(locales).all();
  const dict = new Set(dictRows.map((r) => r.code));

  const nsRows = db.select({ slug: namespaces.slug, locales: namespaces.locales }).from(namespaces).all();
  const missing: Record<string, string[]> = {};
  for (const ns of nsRows) {
    let arr: unknown;
    try {
      arr = JSON.parse(ns.locales);
    } catch {
      continue;
    }
    if (!Array.isArray(arr)) continue;
    for (const c of arr) {
      if (typeof c !== 'string') continue;
      if (dict.has(c)) continue;
      if (!missing[c]) missing[c] = [];
      missing[c]!.push(ns.slug);
    }
  }

  const missingCodes = Object.keys(missing);
  if (missingCodes.length === 0) {
    return { ok: true, missing: {}, added: [] };
  }

  if (!opts.autoAdd) {
    return { ok: false, missing, added: [] };
  }

  // Auto-add: insert each missing code as non-builtin, enabled, with placeholder labels.
  const maxSort = db.select({ s: locales.sortOrder }).from(locales).all();
  let nextSort = (maxSort.reduce((max, r) => Math.max(max, r.s), 0) ?? 0) + 10;
  const now = nowMs();
  const added: string[] = [];
  for (const code of missingCodes) {
    db.insert(locales)
      .values({
        code,
        label: code,
        englishLabel: code,
        nativeLabel: null,
        region: null,
        isBuiltin: false,
        enabled: true,
        sortOrder: nextSort,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: locales.code })
      .run();
    added.push(code);
    nextSort += 10;
  }

  return { ok: true, missing, added };
}

function formatReport(report: RepairReport, opts: RepairOptions): string {
  const lines: string[] = [];
  const missingCodes = Object.keys(report.missing);
  if (missingCodes.length === 0) {
    lines.push('No repair needed.');
    return lines.join('\n');
  }
  lines.push(`Found ${missingCodes.length} code(s) referenced by namespaces but missing from dictionary:`);
  for (const code of missingCodes.sort()) {
    const refs = report.missing[code]!.sort();
    lines.push(`  ${code}  ← ${refs.join(', ')}`);
  }
  if (opts.autoAdd) {
    lines.push('');
    lines.push(`Auto-added ${report.added.length} code(s) as non-builtin enabled entries.`);
    lines.push('Edit their labels in /dashboard/locales after upgrade.');
  } else {
    lines.push('');
    lines.push('Re-run with --auto-add to insert these codes into the dictionary,');
    lines.push('or remove the references from each namespace before retrying.');
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  const autoAdd = process.argv.includes('--auto-add');
  const report = repairLocales({ autoAdd });
  console.log(formatReport(report, { autoAdd }));
  process.exit(report.ok ? 0 : 1);
}

if (process.argv[1] && process.argv[1].endsWith('repair-locales.ts')) {
  void main();
}
