/**
 * Saved-device flows shared by both clients: choose a tailnet device, add it,
 * remove one. Opening a sheet and dismissing it are platform steps and stay in
 * the callbacks.
 */
import { CoreError } from '../envelope.ts';
import type { CoreClient } from '../client.ts';
import type { DeviceViewModel } from '../model.ts';
import { remoteAddError } from '../diagnostics.ts';
import { directTransaction, type Transaction, type WritableValue } from './types.ts';

const reason = (error: unknown) => (error instanceof CoreError ? error.reason : String(error));

export interface AddDeviceSignals {
  readonly name: WritableValue<string>;
  readonly selection: WritableValue<string>;
  readonly busy: WritableValue<boolean>;
  readonly error: WritableValue<string>;
}

export interface RemoteMessages {
  readonly chooseDevice: string;
}

export interface RemoteOptions {
  readonly core: Pick<CoreClient, 'addRemote' | 'removeRemote'>;
  readonly addDevice: AddDeviceSignals;
  readonly transaction?: Transaction;
  /** Refreshes the saved devices after a change. */
  readonly load: () => Promise<unknown>;
  /** Platform step after a successful add: close the sheet, dismiss the modal. */
  readonly afterAdd: () => void;
  readonly confirmRemove: (device: DeviceViewModel) => Promise<boolean>;
  /** Cleanup that runs as soon as removal is confirmed. */
  readonly afterConfirmed: (device: DeviceViewModel) => void;
  /** UI transition after the removal request succeeded. */
  readonly onRemoved?: (device: DeviceViewModel) => void;
  readonly messages: RemoteMessages;
  readonly tag: string;
}

export function createRemoteFlows(options: RemoteOptions) {
  const { core, addDevice, load, afterAdd, confirmRemove, afterConfirmed, messages, tag } = options;
  const transaction = options.transaction ?? directTransaction;

  function choose(name: string): void {
    transaction(() => { addDevice.selection.set(name); addDevice.name.set(''); addDevice.error.set(''); });
  }

  function setAddName(value: string): void {
    transaction(() => { addDevice.name.set(value); addDevice.selection.set(''); addDevice.error.set(''); });
  }

  function submit(): void {
    const name = (addDevice.name().trim() || addDevice.selection()).toLowerCase();
    if (addDevice.busy()) return;
    if (!name) {
      addDevice.error.set(messages.chooseDevice);
      return;
    }
    transaction(() => { addDevice.error.set(''); addDevice.busy.set(true); });
    core
      .addRemote(name)
      .then(() => {
        afterAdd();
        return load();
      })
      .catch((cause) => {
        addDevice.error.set(remoteAddError(reason(cause)));
        console.error(`${tag} remote-add-failed`, reason(cause));
      })
      .finally(() => addDevice.busy.set(false));
  }

  function remove(device: DeviceViewModel): void {
    void confirmRemove(device).then((confirmed) => {
      if (!confirmed) return;
      afterConfirmed(device);
      core
        .removeRemote(device.privateName)
        .then(() => {
          options.onRemoved?.(device);
          return load();
        })
        .catch((cause) => console.error(`${tag} remote-remove-failed`, reason(cause)));
    });
  }

  return { choose, setAddName, submit, remove };
}
