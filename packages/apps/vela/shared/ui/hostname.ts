/**
 * The Tailscale hostname rule, shared by the rename form and pinned to Core by
 * `shared/protocol/fixtures/hostname-validation.json`.
 *
 * The pattern is the one iOS has always enforced: a letter or digit first,
 * then letters, digits or hyphens, at most 63 characters in total.
 */
export const HOSTNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,62}$/;

export function isValidHostname(name: string): boolean {
  return HOSTNAME_PATTERN.test(name);
}
