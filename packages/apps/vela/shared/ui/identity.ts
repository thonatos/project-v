/**
 * The account identity the iOS client shows: whether Core holds a usable
 * identity, and the name/initial to render for it.
 */
import type { CoreStatus } from './protocol.ts';

/** Whether Core holds a usable identity: addresses exist and auth is not pending. */
export function signedIn(status: CoreStatus | null): boolean {
  return Boolean(status && status.network !== 'needs-auth' && (status.tailscale?.ips?.length ?? 0) > 0);
}

/** The human name the account shows: Tailscale user, then device name. */
export function userLabel(status: CoreStatus | null): string {
  return status?.tailscale?.user || status?.tailscale?.name || status?.deviceName || '';
}

/** The avatar letter; `?` is the signed-out placeholder. */
export function userInitial(status: CoreStatus | null): string {
  if (!signedIn(status)) return '?';
  const name = userLabel(status);
  return name ? name.split('@')[0].slice(0, 1).toUpperCase() : '?';
}
