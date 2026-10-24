/**
 * The journal, as a log: a time column, a normalised level and the message as
 * the subject. Both clients render these rows; the filter is the level.
 */
import type { DiagnosticLogs } from './protocol.ts';

export type LogLevel = 'error' | 'warn' | 'info';

export interface LogRowModel {
  readonly key: string;
  readonly time: string;
  readonly level: LogLevel;
  readonly levelLabel: string;
  readonly area: string;
  readonly message: string;
}

const LOG_LEVELS: Readonly<Record<LogLevel, string>> = { error: 'ERROR', warn: 'WARN', info: 'INFO' };

/** Normalises a Core level, so an unknown value still renders as information. */
function normalizeLevel(value: string | undefined): LogLevel {
  const level = String(value ?? '').toLowerCase();
  if (level === 'warning') return 'warn';
  return level === 'error' || level === 'warn' || level === 'info' ? level : 'info';
}

/**
 * Formats an RFC 3339 instant as a local wall clock, which is what a log is
 * scanned by. The raw UTC string is neither readable nor column-aligned.
 */
function logTime(atUtc: string): string {
  const at = new Date(atUtc);
  if (Number.isNaN(at.getTime())) return '--:--:--';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`;
}

/**
 * Projects journal entries newest-first into log rows: a time column, a level
 * and the message as the subject. Passing a level narrows the result.
 */
export function logRows(logs: DiagnosticLogs | null, level: LogLevel | 'all' = 'all'): LogRowModel[] {
  return [...(logs?.entries ?? [])]
    .reverse()
    .map((entry, index) => {
      const normalized = normalizeLevel(entry.level);
      return {
        key: `${entry.atUtc}-${index}`,
        time: logTime(entry.atUtc),
        level: normalized,
        levelLabel: LOG_LEVELS[normalized],
        area: entry.area ?? '',
        message: entry.message ?? '',
      };
    })
    .filter((row) => level === 'all' || row.level === level);
}

/** Counts entries per level so the filter can show what it would reveal. */
export function logLevelCounts(logs: DiagnosticLogs | null): Record<'all' | LogLevel, number> {
  const counts: Record<'all' | LogLevel, number> = { all: 0, error: 0, warn: 0, info: 0 };
  for (const entry of logs?.entries ?? []) {
    counts.all += 1;
    counts[normalizeLevel(entry.level)] += 1;
  }
  return counts;
}
