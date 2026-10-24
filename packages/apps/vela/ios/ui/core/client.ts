/**
 * iOS Core client: the shared control client over the Rust `CoreBridge`, plus
 * the lifecycle and page hooks this app alone uses.
 */
import { CoreBridge } from 'vela/native';
import { createCoreClient } from '../../../shared/ui/client';

export { CoreError } from '../../../shared/ui/envelope';

export const core = {
  protocolVersion: () => CoreBridge.protocolVersion(),
  start: () => CoreBridge.start(''),
  ...createCoreClient({ request: (kind: string, payload: string) => CoreBridge.request(kind, payload) }),
  openExternal: (url: string) => CoreBridge.openExternal(url),
  drainEvents: () => CoreBridge.drainEvents(),
  setPageStatusBar: (style: 'dark' | 'light' | 'app') => CoreBridge.setPageStatusBar(style),
};
