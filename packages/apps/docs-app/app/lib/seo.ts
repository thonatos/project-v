const SITE_NAME = 'ρV';

export function pageTitle(...parts: Array<string | null | undefined>): string {
  return [...parts.filter((part): part is string => Boolean(part)), SITE_NAME].join(' | ');
}
