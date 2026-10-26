/**
 * Device rename shared by both clients. The platform decides where the draft
 * starts, how the form opens and closes, and what refresh follows a save.
 */
import { CoreError } from '../envelope.ts';
import type { CoreClient } from '../client.ts';
import type { CoreStatus } from '../protocol.ts';
import { isValidHostname } from '../hostname.ts';
import { directTransaction, type Transaction, type WritableValue } from './types.ts';

const reason = (error: unknown) => (error instanceof CoreError ? error.reason : String(error));

export interface RenameMessages {
  readonly empty: string;
  readonly invalid: string;
}

export interface RenameOptions {
  readonly core: Pick<CoreClient, 'renameDevice'>;
  readonly status: WritableValue<CoreStatus | null>;
  readonly draft: WritableValue<string>;
  readonly error: WritableValue<string>;
  readonly busy?: WritableValue<boolean>;
  readonly transaction?: Transaction;
  /** The starting value: the current name, or empty when it is a placeholder. */
  readonly initial: () => string;
  readonly open: () => void;
  readonly close: () => void;
  readonly afterSave?: () => void;
  readonly messages: RenameMessages;
}

export function createRenameFlow(options: RenameOptions) {
  const { core, status, draft, error, busy, messages } = options;
  const transaction = options.transaction ?? directTransaction;

  function begin(): void {
    transaction(() => {
      draft.set(options.initial());
      error.set('');
      options.open();
    });
  }

  function save(): void {
    const name = draft().trim();
    if (!name) {
      error.set(messages.empty);
      return;
    }
    // Validate before taking the busy flag: a rejected name must leave the
    // form usable, not stuck behind a permanent spinner.
    if (!isValidHostname(name)) {
      error.set(messages.invalid);
      return;
    }
    if (busy?.()) return;
    busy?.set(true);
    core
      .renameDevice(name)
      .then((payload) => {
        const effective = payload.deviceName ?? name;
        const snapshot = status();
        if (snapshot)
          status.set({ ...snapshot, deviceName: effective, tailscale: { ...snapshot.tailscale, name: effective } });
        options.close();
        options.afterSave?.();
      })
      .catch((cause) => error.set(reason(cause)))
      .finally(() => busy?.set(false));
  }

  return { begin, save };
}
