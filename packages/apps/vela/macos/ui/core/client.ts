/**
 * macOS Core client: the shared control client plus the platform extras only
 * this host can provide (opening URLs, the performance HUD).
 */
import { CoreBridge } from 'vela/native';
import { createCoreClient } from '../../../shared/ui/client';

export { CoreError } from '../../../shared/ui/envelope';

export const core = {
  ...createCoreClient({ request: (kind: string, payload: string) => CoreBridge.request(kind, payload) }),
  /** Hands a URL to the user's default browser. */
  openExternal: (url: string) => CoreBridge.openExternal(url),
  setPerformanceHud: (enabled: boolean) => CoreBridge.setPerformanceHud(enabled),
};
