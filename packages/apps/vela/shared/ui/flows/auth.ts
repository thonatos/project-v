/**
 * Identity flows shared by both clients: start the browser login, wait for it,
 * re-check the identity, and sign out. Platform wording and the "what happens
 * after" steps are injected; the protocol handling is not duplicated.
 */
import { CoreError } from '../envelope.ts';
import type { CoreClient } from '../client.ts';
import type { Signal } from './types.ts';

const reason = (error: unknown) => (error instanceof CoreError ? error.reason : String(error));

export interface AuthMessages {
  readonly startFailed: string;
  readonly notConnected: string;
  readonly reconnectFailed: string;
  readonly recheckFailed: string;
}

export interface AuthOptions {
  readonly core: Pick<CoreClient, 'startAuth' | 'reconnect' | 'logout'>;
  /** Hands the Tailscale login URL to the platform. */
  readonly openExternal: (url: string) => void;
  readonly pending: Signal<boolean>;
  readonly error: Signal<string>;
  readonly rechecking: Signal<boolean>;
  /** Reloads the Core snapshot; `true` also refreshes remote manifests. */
  readonly load: (refresh?: boolean) => Promise<unknown>;
  readonly isConnected: () => boolean;
  readonly confirmLogout: () => Promise<boolean>;
  readonly messages: AuthMessages;
  /** Prefix for console diagnostics, e.g. `VELA_STATE`. */
  readonly tag: string;
  readonly onLogoutError?: (error: unknown) => void;
}

export interface ReconnectOptions {
  /** Replaces the default message when the re-check fails. */
  readonly failure?: (error: unknown) => string;
}

export function createAuthFlows(options: AuthOptions) {
  const { core, pending, error, rechecking, load, isConnected, confirmLogout, messages, tag } = options;

  function signIn(): void {
    error.set('');
    pending.set(true);
    core
      .startAuth()
      .then((payload) => {
        if (!payload.authUrl) throw new CoreError('未收到登录地址');
        options.openExternal(payload.authUrl);
      })
      .catch((cause) => {
        pending.set(false);
        error.set(messages.startFailed);
        console.error(`${tag} auth-start-failed`, reason(cause));
      });
  }

  /** macOS: the browser login happened outside the app, so poll the snapshot. */
  function check(): void {
    void load(true).then(() => {
      if (!isConnected()) {
        error.set(messages.notConnected);
      } else {
        pending.set(false);
        error.set('');
      }
    });
  }

  /**
   * Makes the node log in to control again. This is the only way a device
   * removed in the admin console is found out while Vela is running.
   */
  function reconnect(overrides: ReconnectOptions = {}): void {
    if (rechecking()) return;
    rechecking.set(true);
    error.set('');
    core
      .reconnect()
      .then((result) => {
        if (result.state === 'needs-auth') pending.set(false);
        return load(true);
      })
      .catch((cause) => {
        error.set(overrides.failure?.(cause) ?? messages.reconnectFailed);
        console.error(`${tag} auth-reconnect-failed`, reason(cause));
      })
      .finally(() => rechecking.set(false));
  }

  function logout(): void {
    void confirmLogout().then((confirmed) => {
      if (!confirmed) return;
      core
        .logout()
        .then(() => load())
        .catch((cause) => {
          if (options.onLogoutError) options.onLogoutError(cause);
          else console.error(`${tag} auth-logout-failed`, reason(cause));
        });
    });
  }

  return { signIn, check, reconnect, logout };
}
